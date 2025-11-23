const { query } = require('../db');
const YahooFinance = require('yahoo-finance2').default;

// Valós árfolyam frissítés Yahoo Finance API-val
class StockPriceSimulator {
  constructor() {
    // Yahoo Finance példány létrehozása
    this.yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
    
    // Symbol mapping: adatbázis symbol -> Yahoo Finance symbol
    this.symbolMap = {
      'AAPL': 'AAPL',
      'GOOGL': 'GOOGL',
      'MSFT': 'MSFT',
      'TSLA': 'TSLA',
      'AMZN': 'AMZN',
      'META': 'META',
      'NVDA': 'NVDA',
      'BTC': 'BTC-USD', // Bitcoin Yahoo Finance symbol
    };
    
    // Előző árak tárolása a változás számításához
    this.previousPrices = {};
  }

  // Yahoo Finance symbol lekérése
  getYahooSymbol(dbSymbol) {
    return this.symbolMap[dbSymbol] || dbSymbol;
  }

  // Valós árfolyam frissítés Yahoo Finance API-ból
  async updateStockPrice(stock) {
    try {
      const yahooSymbol = this.getYahooSymbol(stock.symbol);
      const previousPrice = this.previousPrices[stock.symbol] || Number(stock.price);
      
      // Yahoo Finance API hívás
      const quote = await this.yahooFinance.quote(yahooSymbol);
      
      if (!quote || !quote.regularMarketPrice) {
        console.warn(`Nem sikerült lekérni az árat a ${stock.symbol} részvényhez`);
        return null;
      }

      const newPrice = Number(quote.regularMarketPrice);
      // regularMarketChangePercent már százalékban van (pl. 1.97 = 1.97%)
      const changePercent = quote.regularMarketChangePercent !== undefined && quote.regularMarketChangePercent !== null
        ? Number(quote.regularMarketChangePercent)
        : ((newPrice - previousPrice) / previousPrice) * 100;

      // Előző ár mentése
      this.previousPrices[stock.symbol] = newPrice;

      return {
        price: newPrice,
        change_percent: changePercent
      };
    } catch (err) {
      console.error(`Hiba a ${stock.symbol} árfolyam frissítésekor:`, err.message);
      // Ha hiba van, akkor nem frissítjük az árat
      return null;
    }
  }

  // Összes részvény árfolyamának frissítése
  async updateAllPrices() {
    try {
      const stocks = await query('SELECT * FROM stocks');
      
      // Párhuzamos frissítés minden részvényhez
      const updatePromises = stocks.map(async (stock) => {
        const updated = await this.updateStockPrice(stock);
        
        if (updated) {
          await query(
            'UPDATE stocks SET price = ?, change_percent = ? WHERE id = ?',
            [updated.price, updated.change_percent, stock.id]
          );
          return true;
        }
        return false;
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => r).length;

      console.log(`✅ ${successCount}/${stocks.length} részvény árfolyama frissítve`);
      return successCount;
    } catch (err) {
      console.error('Árfolyam frissítési hiba:', err);
      throw err;
    }
  }
}

const simulator = new StockPriceSimulator();

// Automatikus árfolyam frissítés (percenként)
let priceUpdateInterval = null;

function startPriceUpdates() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
  }

  // Azonnali frissítés
  simulator.updateAllPrices().catch(err => {
    console.error('Árfolyam frissítési hiba:', err);
  });

  // Percenkénti frissítés
  priceUpdateInterval = setInterval(() => {
    simulator.updateAllPrices().catch(err => {
      console.error('Árfolyam frissítési hiba:', err);
    });
  }, 60000); // 60 másodperc = 1 perc

  console.log('📈 Árfolyam frissítés elindítva (percenként)');
}

function stopPriceUpdates() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
  }
}

module.exports = {
  simulator,
  startPriceUpdates,
  stopPriceUpdates
};

