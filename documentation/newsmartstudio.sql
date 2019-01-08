-- phpMyAdmin SQL Dump
-- version 4.7.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Creato il: Gen 07, 2019 alle 16:02
-- Versione del server: 10.1.22-MariaDB
-- Versione PHP: 7.1.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `newsmartstudio`
--

-- --------------------------------------------------------

--
-- Struttura della tabella `anchor`
--

CREATE TABLE `anchor` (
  `id` int(11) NOT NULL,
  `mac_anchor` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `zone` int(11) NOT NULL,
  `emergency_zone` int(11) NOT NULL,
  `proximity` tinyint(4) NOT NULL,
  `x_pos_anchor` int(11) NOT NULL,
  `y_pos_anchor` int(11) NOT NULL,
  `radius` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL,
  `neighbors` longtext NOT NULL,
  `z_h_pos_anchor` int(11) NOT NULL,
  `floor` int(11) NOT NULL,
  `permitted_asset` longtext NOT NULL,
  `ip` varchar(255) NOT NULL,
  `isonline` bit(1) NOT NULL,
  `rssi_threeshold` int(11) NOT NULL,
  `timestamp_alarm` datetime NOT NULL,
  `battery_status` bit(1) NOT NULL,
  `battery_status_alerted` bit(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `event`
--

CREATE TABLE `event` (
  `id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `icon_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dump dei dati per la tabella `event`
--

INSERT INTO `event` (`id`, `description`, `icon_name`) VALUES
(1, 'BATTERIA_SCARICA', 'Batteria.png'),
(5, 'BATTERIA_OK', 'FullBattery.png'),
(9, 'CAMBIO_POSIZIONE', 'PosChanged.png'),
(17, 'USCITA', 'Exit.png'),
(18, 'ROTTO_O_RUBATO', 'FuoriCampo.png'),
(19, 'ANCHOR_PROBLEM_ALERT', 'AnchorProblem.png'),
(20, 'ANCHOR_OK_ALERT', 'AnchorOk.png'),
(25, 'MOVIMENTO', 'Moving.png'),
(26, 'FERMO', 'Stop.png');

-- --------------------------------------------------------

--
-- Struttura della tabella `floor`
--

CREATE TABLE `floor` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` int(11) NOT NULL,
  `draw_point` text NOT NULL,
  `image_map` longtext NOT NULL,
  `map_width` int(11) NOT NULL,
  `map_spacing` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `history`
--

CREATE TABLE `history` (
  `id` int(11) NOT NULL,
  `tag` int(11) NOT NULL,
  `anchor` int(11) NOT NULL,
  `timestamp` datetime NOT NULL,
  `tag_x_pos` int(11) NOT NULL,
  `tag_y_pos` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `location`
--

CREATE TABLE `location` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `description` varchar(2048) NOT NULL,
  `is_inside` bit(1) NOT NULL,
  `latitude_top_left` double NOT NULL,
  `longitude_top_left` double NOT NULL,
  `latitude_bottom_right` double NOT NULL,
  `longitude_bottom_right` double NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `rtls`
--

CREATE TABLE `rtls` (
  `rssi_threshold` int(11) NOT NULL,
  `packets` int(11) NOT NULL,
  `scanning_rate` int(11) NOT NULL,
  `interval_beacon_valid` int(11) NOT NULL,
  `timestamp_le` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `tag`
--

CREATE TABLE `tag` (
  `id` int(11) NOT NULL,
  `mac` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` int(11) NOT NULL,
  `xpos` double NOT NULL,
  `ypos` double NOT NULL,
  `zpos` double NOT NULL,
  `gps_north_degrees` double NOT NULL,
  `gps_east_degrees` double NOT NULL,
  `centroid` varchar(255) NOT NULL,
  `anchor` int(11) NOT NULL,
  `timestamp` datetime NOT NULL,
  `timestamp_gps` datetime NOT NULL,
  `timestamp_alarm` datetime NOT NULL,
  `battery_status` bit(1) NOT NULL,
  `battery_status_alerted` bit(1) NOT NULL,
  `mandown` bit(1) NOT NULL,
  `mandown_alerted` bit(1) NOT NULL,
  `isexit` bit(1) NOT NULL,
  `man_down_disabled` bit(1) NOT NULL,
  `man_down_disabled_alerted` bit(1) NOT NULL,
  `sos` bit(1) NOT NULL,
  `sos_alerted` bit(1) NOT NULL,
  `man_in_quote` bit(1) NOT NULL,
  `man_in_quote_alerted` bit(1) NOT NULL,
  `call_me_alarm` bit(1) NOT NULL,
  `evacuation_alarm` bit(1) NOT NULL,
  `man_down_tacitated` bit(1) NOT NULL,
  `radio_switched_off` bit(1) NOT NULL,
  `diagnostic_request` bit(1) NOT NULL,
  `helmet_dpi` bit(1) NOT NULL,
  `helmet_dpi_alerted` bit(1) NOT NULL,
  `belt_dpi` bit(1) NOT NULL,
  `belt_dpi_alerted` bit(1) NOT NULL,
  `glove_dpi` bit(1) NOT NULL,
  `glove_dpi_alerted` bit(1) NOT NULL,
  `show_dpi` bit(1) NOT NULL,
  `show_dpi_alerted` bit(1) NOT NULL,
  `rope_dpi` bit(1) NOT NULL,
  `alarm_timing` int(11) NOT NULL,
  `disable_timing` int(11) NOT NULL,
  `no_mov_timing` int(11) NOT NULL,
  `adv_rate` int(11) NOT NULL,
  `scannning_rate` int(11) NOT NULL,
  `power_level` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `tracking`
--

CREATE TABLE `tracking` (
  `id` int(11) NOT NULL,
  `TIMESTAMP` datetime NOT NULL,
  `tag` int(11) NOT NULL,
  `anchor` int(11) NOT NULL,
  `xpos` double DEFAULT NULL,
  `ypos` double DEFAULT NULL,
  `zpos` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` char(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `user_location`
--

CREATE TABLE `user_location` (
  `location` int(11) NOT NULL,
  `user` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Struttura della tabella `wifi`
--

CREATE TABLE `wifi` (
  `mac_server_rtls` varchar(255) NOT NULL,
  `ip` varchar(255) NOT NULL,
  `udp_port` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dump dei dati per la tabella `wifi`
--

INSERT INTO `wifi` (`mac_server_rtls`, `ip`, `udp_port`) VALUES
('B8:27:EB:A7:1A:DE', '192.168.0.130', 4000);

-- --------------------------------------------------------

--
-- Struttura della tabella `zones`
--

CREATE TABLE `zones` (
  `id` int(11) NOT NULL,
  `x_left` float NOT NULL,
  `x_right` float NOT NULL,
  `y_up` float NOT NULL,
  `y_down` float NOT NULL,
  `name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `anchor`
--
ALTER TABLE `anchor`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `event`
--
ALTER TABLE `event`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `floor`
--
ALTER TABLE `floor`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `location`
--
ALTER TABLE `location`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `tag`
--
ALTER TABLE `tag`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `user_location`
--
ALTER TABLE `user_location`
  ADD PRIMARY KEY (`user`,`location`) USING BTREE;

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `anchor`
--
ALTER TABLE `anchor`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT per la tabella `event`
--
ALTER TABLE `event`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;
--
-- AUTO_INCREMENT per la tabella `floor`
--
ALTER TABLE `floor`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT per la tabella `location`
--
ALTER TABLE `location`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT per la tabella `tag`
--
ALTER TABLE `tag`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT per la tabella `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
