-- Részvények és Portfolio táblák létrehozása

-- Stocks tábla
CREATE TABLE IF NOT EXISTS stocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  change_percent DECIMAL(5,2) DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stock holdings tábla
CREATE TABLE IF NOT EXISTS stock_holdings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  stock_id INT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL,
  average_price DECIMAL(10,2) NOT NULL,
  total_invested DECIMAL(12,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (stock_id) REFERENCES stocks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_stock (user_id, stock_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kezdeti részvények beszúrása
INSERT INTO stocks (symbol, name, price, change_percent) VALUES
('AAPL', 'Apple Inc.', 175.50, 0),
('GOOGL', 'Alphabet Inc.', 142.80, 0),
('MSFT', 'Microsoft Corp.', 378.90, 0),
('TSLA', 'Tesla Inc.', 248.20, 0),
('AMZN', 'Amazon.com Inc.', 145.30, 0),
('META', 'Meta Platforms', 312.40, 0),
('NVDA', 'NVIDIA Corp.', 485.60, 0),
('BTC', 'Bitcoin', 43250.00, 0)
ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price);

