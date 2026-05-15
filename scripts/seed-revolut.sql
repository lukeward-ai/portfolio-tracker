-- Revolut Trading IE — REKV000667 — Closed Aug 2023
-- Account period: 17 Feb 2020 – 21 Aug 2023, all positions closed
-- All transactions in USD
-- AAPL 02 Mar 2020 buy adjusted 5@$282.37 → 20@$70.5925 for 4:1 split (31 Aug 2020)
-- APE spinoff and APE sell omitted (no cost basis from a buy)
-- Run in Supabase SQL editor

DO $$
DECLARE
  v_user_id  uuid := 'ed66494f-e701-4b4f-8530-e341f3dfa225';
  v_port_id  uuid;
BEGIN

  -- 1. Create Revolut portfolio
  INSERT INTO portfolios (user_id, name, description)
  VALUES (v_user_id, 'Revolut', 'Revolut Trading IE — REKV000667 — Closed Aug 2023')
  RETURNING id INTO v_port_id;

  -- 2. Insert all BUY / SELL trades

  -- ── AAPL ────────────────────────────────────────────────────────────────────
  -- Pre-split buy adjusted 4:1 (original: 5 @ $282.37)
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AAPL', 'Apple Inc.', 20, 70.5925, 'USD', 0, '2020-03-02 14:31:03+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AAPL', 'Apple Inc.', 8, 131.00, 'USD', 0, '2020-09-02 16:24:07+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AAPL', 'Apple Inc.', 12, 113.05, 'USD', 0, '2020-09-04 14:52:20+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AAPL', 'Apple Inc.', 2.0865131, 113.74, 'USD', 0, '2020-09-16 16:01:22+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AAPL', 'Apple Inc.', 2, 109.36, 'USD', 1.17, '2020-11-03 14:52:08+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AAPL', 'Apple Inc.', 0.05301289, 113.18, 'USD', 1.18, '2020-11-04 14:57:09+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AAPL', 'Apple Inc.', 0.13115327, 114.37, 'USD', 1.18, '2020-11-04 15:38:25+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AAPL', 'Apple Inc.', 3.90234694, 142.56, 'USD', 1.23, '2021-01-26 15:52:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AAPL', 'Apple Inc.', 40, 156.82, 'USD', 0.04, '2022-01-24 17:49:21+00');

  -- ── DIS ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'DIS', 'The Walt Disney Company', 9, 118.95, 'USD', 0, '2020-03-02 14:32:49+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'DIS', 'The Walt Disney Company', 1, 119.00, 'USD', 0, '2020-03-02 14:34:12+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'DIS', 'The Walt Disney Company', 10, 184.18, 'USD', 1.21, '2021-03-05 16:35:06+00');

  -- ── META ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'META', 'Meta Platforms Inc.', 5, 141.17, 'USD', 0, '2020-03-18 19:02:28+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'META', 'Meta Platforms Inc.', 0.88608445, 267.83, 'USD', 0, '2020-09-16 16:01:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'META', 'Meta Platforms Inc.', 0.04261212, 281.61, 'USD', 1.18, '2020-11-04 14:57:33+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'META', 'Meta Platforms Inc.', 0.05281132, 284.03, 'USD', 1.18, '2020-11-04 15:38:08+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'META', 'Meta Platforms Inc.', 0.79066101, 284.42, 'USD', 1.22, '2021-01-26 15:51:44+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'META', 'Meta Platforms Inc.', 5, 311.91, 'USD', 0.02, '2021-05-19 17:46:19+00');

  -- ── ATVI ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'ATVI', 'Activision Blizzard Inc.', 10, 56.38, 'USD', 0, '2020-03-19 14:01:44+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'ATVI', 'Activision Blizzard Inc.', 10, 91.03, 'USD', 1.20, '2021-03-05 16:42:06+00');

  -- ── ZNGA ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'ZNGA', 'Zynga Inc.', 100, 9.19, 'USD', 0, '2020-06-09 15:56:41+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'ZNGA', 'Zynga Inc.', 100, 10.10, 'USD', 0.02, '2021-05-17 13:53:19+00');

  -- ── AMZN ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMZN', 'Amazon.com Inc.', 0.07559984, 3139.16, 'USD', 0, '2020-09-16 16:00:49+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMZN', 'Amazon.com Inc.', 0.00186933, 3209.71, 'USD', 1.18, '2020-11-04 15:37:52+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMZN', 'Amazon.com Inc.', 0.07373051, 3321.56, 'USD', 1.23, '2021-01-26 15:42:42+00');

  -- ── GOOGL ───────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'GOOGL', 'Alphabet Inc.', 0.15444186, 1536.63, 'USD', 1.18, '2020-09-16 16:02:44+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'GOOGL', 'Alphabet Inc.', 0.5, 1428.44, 'USD', 1.16, '2020-09-24 17:30:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'GOOGL', 'Alphabet Inc.', 0.0162715, 1720.80, 'USD', 1.18, '2020-11-04 14:56:52+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'GOOGL', 'Alphabet Inc.', 0.01713668, 1750.63, 'USD', 1.18, '2020-11-04 15:38:47+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'GOOGL', 'Alphabet Inc.', 0.12103368, 1912.44, 'USD', 1.23, '2021-01-26 15:52:37+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'GOOGL', 'Alphabet Inc.', 0.5, 2030.02, 'USD', 0.02, '2021-03-05 16:21:04+00');

  -- ── NVDA ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'NVDA', 'NVIDIA Corporation', 0.45966669, 511.24, 'USD', 1.18, '2020-09-16 16:04:17+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'NVDA', 'NVIDIA Corporation', 0.01870767, 534.54, 'USD', 1.18, '2020-11-04 14:56:29+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'NVDA', 'NVIDIA Corporation', 0.027572, 544.03, 'USD', 1.18, '2020-11-04 15:39:00+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'NVDA', 'NVIDIA Corporation', 0.41338702, 541.91, 'USD', 1.22, '2021-01-26 15:52:53+00');

  -- ── FSLY ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FSLY', 'Fastly Inc.', 9.9946048, 74.14, 'USD', 0, '2020-10-26 19:07:55+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FSLY', 'Fastly Inc.', 10, 66.64, 'USD', 0, '2020-11-03 14:35:42+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FSLY', 'Fastly Inc.', 10, 63.32, 'USD', 1.19, '2021-03-05 17:33:08+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'FSLY', 'Fastly Inc.', 29.9946048, 18.14, 'USD', 0.02, '2023-08-01 13:30:26+00');

  -- ── ZEN ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'ZEN', 'Zendesk Inc.', 2, 112.38, 'USD', 0, '2020-11-03 14:51:27+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'ZEN', 'Zendesk Inc.', 0.13422818, 119.20, 'USD', 1.18, '2020-11-04 14:56:07+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'ZEN', 'Zendesk Inc.', 0.16301247, 122.69, 'USD', 1.18, '2020-11-04 15:39:16+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'ZEN', 'Zendesk Inc.', 1.70275935, 145.56, 'USD', 1.23, '2021-01-26 15:53:08+00');

  -- ── BYND ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 8, 121.27, 'USD', 0, '2020-11-10 14:30:38+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 2.45, 117.57, 'USD', 0, '2021-05-06 13:59:20+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 20, 120.20, 'USD', 0, '2021-08-31 14:00:12+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 5, 101.37, 'USD', 0, '2021-10-04 14:29:09+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 10, 92.54, 'USD', 0, '2021-10-22 13:40:50+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BYND', 'Beyond Meat Inc.', 15, 65.17, 'USD', 2.43, '2022-02-02 15:46:58+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'BYND', 'Beyond Meat Inc.', 0.45, 153.42, 'USD', 0.01, '2021-06-09 13:30:25+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'BYND', 'Beyond Meat Inc.', 2, 152.53, 'USD', 1.23, '2021-06-09 13:49:53+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'BYND', 'Beyond Meat Inc.', 8, 120.51, 'USD', 0.01, '2021-08-31 13:56:49+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'BYND', 'Beyond Meat Inc.', 50, 16.97, 'USD', 2.13, '2023-08-01 13:30:00+00');

  -- ── SFIX ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SFIX', 'Stitch Fix Inc.', 5.06072874, 39.52, 'USD', 0, '2020-11-30 15:48:31+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SFIX', 'Stitch Fix Inc.', 7, 70.22, 'USD', 1.21, '2021-02-23 15:08:02+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SFIX', 'Stitch Fix Inc.', 15, 50.14, 'USD', 1.18, '2021-03-09 14:54:14+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SFIX', 'Stitch Fix Inc.', 15, 18.87, 'USD', 1.13, '2021-12-08 15:08:58+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SFIX', 'Stitch Fix Inc.', 5.06072874, 51.35, 'USD', 0.02, '2020-12-08 14:49:50+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SFIX', 'Stitch Fix Inc.', 7, 67.37, 'USD', 1.20, '2021-03-05 18:09:41+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SFIX', 'Stitch Fix Inc.', 2.5, 66.45, 'USD', 0.01, '2021-06-09 13:31:23+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SFIX', 'Stitch Fix Inc.', 6.5, 66.57, 'USD', 1.23, '2021-06-09 13:49:53+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SFIX', 'Stitch Fix Inc.', 21, 5.02, 'USD', 0.02, '2023-08-01 13:30:01+00');

  -- ── BNTX ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'BNTX', 'BioNTech SE', 0.8250825, 121.20, 'USD', 0, '2020-12-02 15:20:00+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'BNTX', 'BioNTech SE', 0.8250825, 111.39, 'USD', 1.22, '2021-01-26 15:43:30+00');

  -- ── APPN ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'APPN', 'Appian Corporation', 34.99046646, 146.85, 'USD', 0, '2021-01-04 18:14:24+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'APPN', 'Appian Corporation', 2, 153.91, 'USD', 1.19, '2021-03-18 14:31:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'APPN', 'Appian Corporation', 36.99046646, 51.15, 'USD', 4.76, '2023-08-01 15:24:23+00');

  -- ── FVRR ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 2.98846756, 267.94, 'USD', 0, '2021-01-15 17:17:21+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 1, 236.41, 'USD', 0, '2021-01-19 14:38:32+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 1, 234.94, 'USD', 1.21, '2021-01-19 14:48:56+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 1, 234.92, 'USD', 1.21, '2021-01-19 14:49:04+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 1.01153244, 225.44, 'USD', 1.21, '2021-01-26 15:25:33+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 2, 222.37, 'USD', 1.21, '2021-01-26 16:29:52+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 2, 211.24, 'USD', 1.19, '2021-03-05 17:27:55+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 6, 174.82, 'USD', 2.62, '2021-10-04 14:29:50+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 5, 166.85, 'USD', 0, '2021-11-03 14:27:54+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 10, 148.63, 'USD', 0, '2021-11-23 15:10:42+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 5, 130.00, 'USD', 1.63, '2021-12-02 15:33:23+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 2, 99.69, 'USD', 0, '2022-01-07 16:20:05+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 13, 84.11, 'USD', 0, '2022-01-21 14:34:29+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 10, 81.61, 'USD', 2.02, '2022-01-25 14:42:49+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'FVRR', 'Fiverr International Ltd.', 15, 32.70, 'USD', 0, '2022-05-11 14:40:22+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'FVRR', 'Fiverr International Ltd.', 2, 293.34, 'USD', 0.02, '2021-02-11 15:13:20+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'FVRR', 'Fiverr International Ltd.', 75, 29.37, 'USD', 5.54, '2023-08-01 15:24:37+00');

  -- ── LMND ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 4.99214659, 152.80, 'USD', 0, '2021-01-15 17:17:53+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 3, 149.36, 'USD', 1.21, '2021-01-19 14:39:10+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 3, 151.95, 'USD', 1.21, '2021-01-26 16:30:21+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 3, 124.82, 'USD', 1.21, '2021-02-23 15:09:02+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 5, 100.30, 'USD', 1.20, '2021-03-04 17:06:46+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 5, 89.53, 'USD', 1.19, '2021-03-05 17:27:42+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 18, 76.10, 'USD', 3.42, '2021-09-08 14:04:02+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 24, 54.55, 'USD', 0, '2021-11-18 17:28:28+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 10, 49.83, 'USD', 0, '2021-11-23 15:11:31+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 5, 37.62, 'USD', 0, '2022-01-07 16:19:43+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 30, 31.83, 'USD', 0, '2022-01-21 14:35:08+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 30, 29.45, 'USD', 2.20, '2022-01-25 14:41:57+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'LMND', 'Lemonade Inc.', 9, 25.23, 'USD', 0, '2022-03-25 13:52:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'LMND', 'Lemonade Inc.', 3, 157.16, 'USD', 0.02, '2021-02-11 15:13:51+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'LMND', 'Lemonade Inc.', 146.99214659, 22.27, 'USD', 8.24, '2023-08-01 15:24:56+00');

  -- ── AMC ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMC', 'AMC Entertainment Holdings', 33.10125744, 15.11, 'USD', 1.21, '2021-01-27 15:26:24+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMC', 'AMC Entertainment Holdings', 62.03473945, 16.12, 'USD', 1.20, '2021-01-27 15:55:06+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMC', 'AMC Entertainment Holdings', 5, 12.88, 'USD', 1.21, '2021-01-28 15:18:04+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMC', 'AMC Entertainment Holdings', 34, 14.21, 'USD', 1.20, '2021-02-01 15:48:44+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMC', 'AMC Entertainment Holdings', 40.97688903, 61.01, 'USD', 0, '2021-06-03 13:35:04+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMC', 'AMC Entertainment Holdings', 175.11288592, 4.90, 'USD', 2.19, '2023-08-01 13:30:25+00');

  -- ── SHOP ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SHOP', 'Shopify Inc.', 0.37737747, 1192.44, 'USD', 1.21, '2021-01-26 16:30:09+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SHOP', 'Shopify Inc.', 0.37737747, 1465.22, 'USD', 0.02, '2021-02-11 15:14:09+00');

  -- ── OKTA ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'OKTA', 'Okta Inc.', 1.71193791, 262.86, 'USD', 1.21, '2021-01-26 16:30:36+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'OKTA', 'Okta Inc.', 1.71193791, 288.15, 'USD', 1.23, '2021-02-11 15:14:22+00');

  -- ── RKT ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'RKT', 'Rocket Companies Inc.', 13, 35.71, 'USD', 1.20, '2021-03-02 18:32:38+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'RKT', 'Rocket Companies Inc.', 15, 38.00, 'USD', 1.20, '2021-03-02 19:15:25+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'RKT', 'Rocket Companies Inc.', 13, 38.00, 'USD', 1.21, '2021-03-02 19:15:25+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'RKT', 'Rocket Companies Inc.', 15, 40.80, 'USD', 1.21, '2021-03-02 20:11:07+00');

  -- ── TSLA ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'TSLA', 'Tesla Inc.', 1, 664.45, 'USD', 1.21, '2021-02-23 15:08:27+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'TSLA', 'Tesla Inc.', 1, 580.00, 'USD', 1.20, '2021-03-05 18:07:15+00');

  -- ── PLTR ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 30, 24.50, 'USD', 1.20, '2021-03-03 14:43:10+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 30, 22.62, 'USD', 1.19, '2021-03-05 17:27:15+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 15, 24.09, 'USD', 1.18, '2021-03-08 16:20:44+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 40, 24.00, 'USD', 1.18, '2021-03-08 16:27:32+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 50, 24.56, 'USD', 0, '2021-11-09 15:48:19+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 22.95, 'USD', 0, '2021-11-10 15:46:39+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 21.74, 'USD', 0, '2021-11-18 17:34:56+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 20.40, 'USD', 1.28, '2021-11-23 15:28:34+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 19.94, 'USD', 1.25, '2021-12-01 17:57:09+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 10, 16.58, 'USD', 0, '2022-01-07 16:17:22+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 90, 14.28, 'USD', 0, '2022-01-21 14:32:46+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 13.50, 'USD', 0, '2022-02-15 14:38:03+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 25, 13.25, 'USD', 0, '2022-03-25 13:50:59+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PLTR', 'Palantir Technologies Inc.', 100, 7.42, 'USD', 0, '2022-05-09 17:45:15+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'PLTR', 'Palantir Technologies Inc.', 515, 19.86, 'USD', 25.73, '2023-08-01 15:25:51+00');

  -- ── AMD ─────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMD', 'Advanced Micro Devices Inc.', 8, 76.92, 'USD', 1.19, '2021-03-05 17:36:14+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'AMD', 'Advanced Micro Devices Inc.', 5, 77.33, 'USD', 1.18, '2021-03-08 16:21:21+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMD', 'Advanced Micro Devices Inc.', 2, 109.86, 'USD', 0.01, '2021-08-13 17:42:02+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMD', 'Advanced Micro Devices Inc.', 3, 108.37, 'USD', 0.01, '2021-08-17 14:47:17+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'AMD', 'Advanced Micro Devices Inc.', 8, 114.26, 'USD', 2.31, '2023-08-01 13:30:00+00');

  -- ── CRSR ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 50, 28.70, 'USD', 0, '2021-09-01 14:15:04+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 50, 27.12, 'USD', 0, '2021-09-22 15:59:36+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 14.2281607, 27.13, 'USD', 0, '2021-09-22 16:05:57+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 25, 25.73, 'USD', 0, '2021-09-30 16:24:18+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 50, 24.55, 'USD', 0, '2021-10-15 14:03:05+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 20, 24.65, 'USD', 0, '2021-11-18 17:35:21+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'CRSR', 'Corsair Gaming Inc.', 8, 20.66, 'USD', 0, '2022-01-07 16:21:15+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'CRSR', 'Corsair Gaming Inc.', 25, 27.10, 'USD', 0.01, '2021-09-22 15:57:18+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'CRSR', 'Corsair Gaming Inc.', 192.2281607, 18.54, 'USD', 8.97, '2023-08-01 15:25:15+00');

  -- ── TDOC ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'TDOC', 'Teladoc Health Inc.', 15, 76.88, 'USD', 0, '2022-01-21 14:34:01+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'TDOC', 'Teladoc Health Inc.', 10, 69.06, 'USD', 1.73, '2022-02-08 15:40:14+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'TDOC', 'Teladoc Health Inc.', 25, 29.36, 'USD', 0.02, '2023-08-01 13:30:01+00');

  -- ── SQ ──────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'SQ', 'Block Inc.', 10, 114.36, 'USD', 2.86, '2022-01-25 14:42:33+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'SQ', 'Block Inc.', 10, 79.80, 'USD', 0.02, '2023-08-01 13:30:16+00');

  -- ── PYPL ────────────────────────────────────────────────────────────────────
  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PYPL', 'PayPal Holdings Inc.', 5, 185.00, 'USD', 2.33, '2021-11-29 14:38:01+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PYPL', 'PayPal Holdings Inc.', 5, 159.65, 'USD', 1.99, '2022-01-25 14:42:12+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'BUY', 'PYPL', 'PayPal Holdings Inc.', 10, 133.10, 'USD', 3.33, '2022-02-02 15:27:30+00');

  INSERT INTO transactions (portfolio_id, user_id, type, ticker, name, quantity, price, currency, fees, executed_at)
  VALUES (v_port_id, v_user_id, 'SELL', 'PYPL', 'PayPal Holdings Inc.', 20, 74.86, 'USD', 3.77, '2023-08-01 15:24:04+00');

  RAISE NOTICE 'Revolut portfolio created: %', v_port_id;
  RAISE NOTICE 'All transactions inserted successfully.';

END $$;
