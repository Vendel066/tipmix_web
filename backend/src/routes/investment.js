const express = require('express');
const { pool, query } = require('../db');
const { auth } = require('../middleware/auth');
const YahooFinance = require('yahoo-finance2').default;
const { STOCK_SYMBOLS } = require('../services/stockList');

const router = express.Router();

// USD to HUF árfolyam
const USD_TO_HUF = 360;

// Yahoo Finance példány
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Részvények lekérése közvetlenül a Yahoo Finance API-ból
router.get('/stocks', async (req, res) => {
  try {
    const { search } = req.query;
    
    // Alapból csak a TOP 10-et mutatjuk, keresés esetén az adott szöveggel kezdődőket
    let symbolsToFetch;
    if (search && search.trim()) {
      const searchUpper = search.trim().toUpperCase();
      // Keresés: azzal kezdődő részvények
      symbolsToFetch = STOCK_SYMBOLS.filter(symbol => 
        symbol.toUpperCase().startsWith(searchUpper)
      );
    } else {
      // Alapból csak a TOP 10
      symbolsToFetch = STOCK_SYMBOLS.slice(0, 10);
    }

    // Párhuzamos lekérés minden részvényhez (max 50 egyszerre a teljesítmény miatt)
    const batchSize = 50;
    const allStocks = [];
    
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      const quotes = await Promise.allSettled(
        batch.map(symbol => {
          try {
            return yahooFinance.quote(symbol);
          } catch (err) {
            console.error(`Hiba a ${symbol} lekérésekor:`, err.message);
            return Promise.reject(err);
          }
        })
      );

      quotes.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          const quote = result.value;
          if (quote && quote.regularMarketPrice) {
            allStocks.push({
              symbol: batch[index],
              name: quote.shortName || quote.longName || batch[index],
              price: Number(quote.regularMarketPrice),
              change_percent: quote.regularMarketChangePercent !== undefined && quote.regularMarketChangePercent !== null
                ? Number(quote.regularMarketChangePercent)
                : 0
            });
          }
        } else if (result.status === 'rejected') {
          console.warn(`Nem sikerült lekérni a ${batch[index]} részvényt:`, result.reason?.message || 'Ismeretlen hiba');
        }
      });
    }

    // Rendezés symbol szerint
    allStocks.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return res.json({ stocks: allStocks });
  } catch (err) {
    console.error('Részvények lekérési hiba:', err);
    return res.status(500).json({ message: 'Hiba a részvények lekérése során' });
  }
});

// Portfolio lekérése
router.get('/portfolio', auth(), async (req, res) => {
  try {
    const holdings = await query(
      `SELECT sh.*, sh.symbol, sh.name
       FROM stock_holdings sh
       WHERE sh.user_id = ?
       ORDER BY sh.symbol`,
      [req.user.id]
    );

    // Aktuális árak lekérése a Yahoo Finance API-ból
    const holdingsWithPrices = await Promise.all(
      holdings.map(async (holding) => {
        try {
          const quote = await yahooFinance.quote(holding.symbol);
          const currentPrice = quote.regularMarketPrice 
            ? Number(quote.regularMarketPrice) 
            : Number(holding.average_price);
          
          return {
            ...holding,
            current_price: currentPrice
          };
        } catch (err) {
          console.error(`Hiba a ${holding.symbol} árának lekérésekor:`, err.message);
          return {
            ...holding,
            current_price: Number(holding.average_price)
          };
        }
      })
    );

    return res.json({ holdings: holdingsWithPrices });
  } catch (err) {
    console.error('Portfolio lekérési hiba:', err);
    return res.status(500).json({ message: 'Hiba a portfolio lekérése során' });
  }
});

// Részvény vásárlás
router.post('/buy', auth(), async (req, res) => {
  const { symbol, quantity } = req.body;

  const numericQuantity = parseFloat(quantity);
  if (!symbol || !numericQuantity || numericQuantity <= 0 || isNaN(numericQuantity)) {
    return res.status(400).json({ message: 'Érvénytelen mennyiség vagy symbol' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Részvény adatok lekérése a Yahoo Finance API-ból
    let quote;
    try {
      quote = await yahooFinance.quote(symbol);
    } catch (err) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Részvény nem található' });
    }

    if (!quote || !quote.regularMarketPrice) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Részvény nem található' });
    }

    const stockPrice = Number(quote.regularMarketPrice);
    const stockName = quote.shortName || quote.longName || symbol;
    const totalCost = Math.round(stockPrice * numericQuantity * USD_TO_HUF);

    // Felhasználó egyenleg ellenőrzése
    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id]
    );

    const user = userRows[0];
    if (!user || Number(user.balance) < totalCost) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        message: `Nincs elegendő egyenleg. Szükséges: ${totalCost.toLocaleString('hu-HU')} HUF` 
      });
    }

    // Ellenőrizzük, hogy van-e már ilyen részvény a portfolióban
    const [existingHoldings] = await connection.execute(
      'SELECT * FROM stock_holdings WHERE user_id = ? AND symbol = ? FOR UPDATE',
      [req.user.id, symbol]
    );

    if (existingHoldings.length > 0) {
      // Frissítjük a meglévő pozíciót
      const existing = existingHoldings[0];
      const newQuantity = Number(existing.quantity) + numericQuantity;
      const existingInvestedUSD = Number(existing.total_invested) / USD_TO_HUF;
      const newInvestedUSD = numericQuantity * stockPrice;
      const totalInvestedUSD = existingInvestedUSD + newInvestedUSD;
      const newAveragePrice = totalInvestedUSD / newQuantity;
      const newTotalInvested = Math.round(totalInvestedUSD * USD_TO_HUF);

      await connection.execute(
        `UPDATE stock_holdings 
         SET quantity = ?, average_price = ?, total_invested = ?, name = ?
         WHERE user_id = ? AND symbol = ?`,
        [newQuantity, newAveragePrice, newTotalInvested, stockName, req.user.id, symbol]
      );
    } else {
      // Új pozíció létrehozása
      await connection.execute(
        `INSERT INTO stock_holdings (user_id, symbol, name, quantity, average_price, total_invested)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, symbol, stockName, numericQuantity, stockPrice, totalCost]
      );
    }

    // Egyenleg levonása
    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [totalCost, req.user.id]
    );

    // Új egyenleg lekérése
    const [updatedUser] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id]
    );

    await connection.commit();
    connection.release();

    return res.json({
      message: 'Részvény sikeresen megvásárolva',
      newBalance: Number(updatedUser[0].balance),
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback hiba:', rollbackErr);
      }
      try {
        connection.release();
      } catch (releaseErr) {
        console.error('Release hiba:', releaseErr);
      }
    }
    console.error('Tranzakció hiba:', err);
    return res.status(500).json({ 
      message: 'Hiba a tranzakció során',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;

