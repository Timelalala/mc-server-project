-- Create Database if not exists
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
  status VARCHAR(20) DEFAULT 'offline',
  current_players INT DEFAULT 0,
  max_players INT DEFAULT 20
);

-- Seed servers
INSERT INTO servers (id, name, ip, pi_host, status, current_players, max_players) VALUES
(1, 'Server A (Lobby/Survival)', '192.168.1.11', '192.168.1.11', 'offline', 0, 20),
(2, 'Server B (Creative/Minigames)', '192.168.1.12', '192.168.1.12', 'offline', 0, 20),
(3, 'Server C (Hardcore)', '192.168.1.13', '192.168.1.13', 'offline', 0, 20)
ON DUPLICATE KEY UPDATE name=VALUES(name), ip=VALUES(ip), pi_host=VALUES(pi_host);

-- 3. Time Slots Table
CREATE TABLE IF NOT EXISTS time_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  server_id INT NOT NULL,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- 4. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  server_id INT NOT NULL,
  slot_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
  ip VARCHAR(50) NOT NULL,
  port INT DEFAULT 25565,
  mc_password VARCHAR(100),
  amount DECIMAL(10,2) DEFAULT 0.00,
  slip_file VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
);
