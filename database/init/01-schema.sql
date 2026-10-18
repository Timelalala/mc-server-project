-- Minecraft Server Database Schema for Docker initialization
CREATE DATABASE IF NOT EXISTS mc_server_db;
USE mc_server_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Servers Table (Raspberry Pi servers)
CREATE TABLE IF NOT EXISTS servers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  ip VARCHAR(50) NOT NULL,
  pi_host VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'online',
  current_players INT DEFAULT 0,
  max_players INT DEFAULT 20,
  edition ENUM('java','bedrock') DEFAULT 'java',
  mc_version VARCHAR(20) DEFAULT '1.21',
  mod_name VARCHAR(100) DEFAULT NULL,
  mod_version VARCHAR(20) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  icon VARCHAR(50) DEFAULT NULL,
  session_count INT DEFAULT 0
);

-- Seed servers (Pi #1 - Pi #4)
INSERT INTO servers (id, name, ip, pi_host, status, current_players, max_players, edition, mc_version, mod_name, mod_version, description, icon, session_count) VALUES
(1, 'Java Survival', '192.168.137.1', '192.168.137.1', 'online', 8, 20, 'java', '1.21', NULL, NULL, 'Vanilla Survival โลกธรรมดา เหมาะสำหรับผู้เล่นทุกระดับ', '⛏️', 8),
(2, 'RLCraft', '192.168.137.11', '192.168.137.11', 'online', 4, 20, 'java', '1.12.2', 'RLCraft', '2.9.3', 'Survival สุดโหด มีระบบ Thirst, Hunger, Temperature และ Monster เยอะมาก', '💀', 4),
(3, 'RL Dregora', '192.168.137.12', '192.168.137.12', 'online', 0, 20, 'java', '1.12.2', 'RLCraft + Dregora', '2.9.3', 'RLCraft รุ่น Dregora มี Biome และ Structure เพิ่มเติม กราฟิกสวยกว่าปกติ', '🐉', 0),
(4, 'Pixelmon', '192.168.137.13', '192.168.137.13', 'online', 12, 20, 'java', '1.16.5', 'Pixelmon Mod', '9.1.11', 'เล่น Minecraft แบบ Pokemon จับ เทรน และต่อสู้กับ Pokemon ในโลก Minecraft', '⚡', 12)
ON DUPLICATE KEY UPDATE 
  name=VALUES(name), ip=VALUES(ip), pi_host=VALUES(pi_host), 
  edition=VALUES(edition), mc_version=VALUES(mc_version), 
  mod_name=VALUES(mod_name), mod_version=VALUES(mod_version), 
  description=VALUES(description), icon=VALUES(icon),
  session_count=VALUES(session_count);

-- 3. Dynamic Pricing Rules
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NULL,
  booking_type ENUM('timeslot','fullday','multiday','slot','daily') NOT NULL,
  duration_hours INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Seed default pricing rules
INSERT INTO pricing_rules (id, server_id, booking_type, duration_hours, price, is_active) VALUES
(1, NULL, 'timeslot', 2, 50.00, TRUE),
(2, NULL, 'fullday', 24, 200.00, TRUE),
(3, NULL, 'multiday', 24, 180.00, TRUE),
(4, NULL, 'daily', 8, 90.00, TRUE)
ON DUPLICATE KEY UPDATE duration_hours=VALUES(duration_hours), price=VALUES(price), is_active=VALUES(is_active);

-- 4. Time Slots Table
CREATE TABLE IF NOT EXISTS time_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NOT NULL,
  booking_id INT NULL,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  status ENUM('available','reserved','booked') DEFAULT 'available',
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- 5. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  server_id INT NOT NULL,
  slot_id INT NULL,
  booking_type ENUM('timeslot','fullday','multiday','slot','daily') DEFAULT 'timeslot',
  start_date DATE NULL,
  end_date DATE NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  lock_expires_at DATETIME NULL,
  session_id VARCHAR(100) NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
  ip VARCHAR(50) NOT NULL,
  port INT DEFAULT 25565,
  mc_password VARCHAR(100),
  amount DECIMAL(10,2) DEFAULT 0.00,
  slip_file VARCHAR(255),
  omise_charge_id VARCHAR(100),
  payment_status ENUM('unpaid','pending','paid','failed','expired','cancelled') DEFAULT 'unpaid',
  slot_status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  online_players TEXT NULL,
  seen_players TEXT NULL,
  slot_updated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
  INDEX idx_server_availability (server_id, payment_status, start_time, end_time)
);

-- 6. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NOT NULL,
  booking_id INT NOT NULL,
  user_id INT NOT NULL,
  player_name VARCHAR(50),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (server_id) REFERENCES servers(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
