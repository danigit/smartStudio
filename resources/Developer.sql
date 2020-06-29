-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versione server:              10.4.8-MariaDB - mariadb.org binary distribution
-- S.O. server:                  Win64
-- HeidiSQL Versione:            11.0.0.5919
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;


-- Dump della struttura del database smarttrack
CREATE DATABASE IF NOT EXISTS `smarttrack` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;
USE `smarttrack`;

-- Dump della struttura di tabella smarttrack.access_control
CREATE TABLE IF NOT EXISTS `access_control` (
  `ID` int(11) NOT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.access_control_history
CREATE TABLE IF NOT EXISTS `access_control_history` (
  `TAG_ID` int(11) NOT NULL,
  `EVENT_ID` int(11) NOT NULL,
  `ANCHOR_AOA_ID` int(11) NOT NULL,
  `TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `MSEC` smallint(2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`EVENT_ID`,`TAG_ID`,`TIME`,`MSEC`) USING BTREE,
  KEY `TAG_HISTORY` (`TAG_ID`),
  KEY `EVENT_HISTORY` (`EVENT_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.anchor
CREATE TABLE IF NOT EXISTS `anchor` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `MAC` varchar(255) DEFAULT NULL,
  `NAME` varchar(255) DEFAULT NULL,
  `TYPE` tinyint(4) NOT NULL DEFAULT 3,
  `EMERGENCY_ZONE` int(11) NOT NULL DEFAULT -1,
  `X_POS` double NOT NULL DEFAULT -1,
  `Y_POS` double NOT NULL DEFAULT -1,
  `Z_POS` double NOT NULL DEFAULT -1,
  `RADIUS` double NOT NULL DEFAULT -1,
  `NEIGHBORS` longtext DEFAULT NULL,
  `PROXIMITY` int(11) NOT NULL DEFAULT 1,
  `IP` varchar(255) DEFAULT NULL,
  `PERMITTED_ASSET` longtext DEFAULT NULL,
  `RSSI_THRESHOLD` int(11) NOT NULL DEFAULT 170,
  `ALARM_TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `BATTERY_STATUS` bit(1) NOT NULL DEFAULT b'0',
  `BATTERY_STATUS_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `IS_OFFLINE` bit(1) NOT NULL DEFAULT b'0',
  `IS_OFFLINE_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `FLOOR_ID` int(11) DEFAULT NULL,
  `BATTERY_LEVEL` int(11) DEFAULT 0,
  PRIMARY KEY (`ID`),
  KEY `FLOOR_ID` (`FLOOR_ID`),
  CONSTRAINT `anchor_floor` FOREIGN KEY (`FLOOR_ID`) REFERENCES `floor` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=139 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.anchor_types
CREATE TABLE IF NOT EXISTS `anchor_types` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `ICON` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.camera
CREATE TABLE IF NOT EXISTS `camera` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `IP` varchar(255) DEFAULT NULL,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `USERNAME` varchar(255) DEFAULT NULL,
  `PASSWORD` varchar(255) DEFAULT NULL,
  `RADIUS` double DEFAULT NULL,
  `X_POS` double DEFAULT NULL,
  `Y_POS` double DEFAULT NULL,
  `NVR` varchar(255) DEFAULT NULL,
  `FLOOR_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `USER_PASS` (`USERNAME`,`PASSWORD`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.category
CREATE TABLE IF NOT EXISTS `category` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `ICON_NAME_ALARM` varchar(255) DEFAULT NULL,
  `ICON_NAME_NO_ALARM` varchar(255) DEFAULT NULL,
  `ICON_NAME_OFFLINE` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.contacts_x_covid
CREATE TABLE IF NOT EXISTS `contacts_x_covid` (
  `CONTACT_DATE` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `ID_PERSON1` int(11) NOT NULL,
  `ID_PERSON2` int(11) NOT NULL,
  `MIN_RSSI` tinyint(4) DEFAULT NULL,
  `MAX_RSSI` tinyint(4) DEFAULT NULL,
  `AVG_RSSI` tinyint(4) DEFAULT NULL,
  `COUNT_PACKETS` int(11) DEFAULT NULL,
  `DURATION` int(11) DEFAULT NULL,
  PRIMARY KEY (`CONTACT_DATE`,`ID_PERSON1`,`ID_PERSON2`),
  KEY `FK_CONTACTS_PERSON1` (`ID_PERSON1`),
  KEY `FK_CONTACTS_PERSON2` (`ID_PERSON2`),
  CONSTRAINT `FK_CONTACTS_PERSON1` FOREIGN KEY (`ID_PERSON1`) REFERENCES `person_x_codid` (`ID`),
  CONSTRAINT `FK_CONTACTS_PERSON2` FOREIGN KEY (`ID_PERSON2`) REFERENCES `person_x_codid` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.dress_alarm
CREATE TABLE IF NOT EXISTS `dress_alarm` (
  `TAG_ID` int(11) NOT NULL,
  `HELMET_DPI` bit(1) DEFAULT b'0',
  `HELMET_DPI_ALERTED` bit(1) DEFAULT b'0',
  `BELT_DPI` bit(1) DEFAULT b'0',
  `BELT_DPI_ALERTED` bit(1) DEFAULT b'0',
  `GLOVE_DPI` bit(1) DEFAULT b'0',
  `GLOVE_DPI_ALERTED` bit(1) DEFAULT b'0',
  `SHOE_DPI` bit(1) DEFAULT b'0',
  `SHOE_DPI_ALERTED` bit(1) DEFAULT b'0',
  PRIMARY KEY (`TAG_ID`),
  CONSTRAINT `TAG_DRESS_ALARM` FOREIGN KEY (`TAG_ID`) REFERENCES `tag` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.event
CREATE TABLE IF NOT EXISTS `event` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) NOT NULL,
  `ICON_NAME` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.floor
CREATE TABLE IF NOT EXISTS `floor` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `DRAW_POINT` text DEFAULT NULL,
  `IMAGE_MAP` varchar(255) DEFAULT NULL,
  `MAP_WIDTH` float DEFAULT NULL,
  `MAP_SPACING` int(11) DEFAULT NULL,
  `LOCATION_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `LOCATION_ID` (`LOCATION_ID`),
  CONSTRAINT `dsafdsafasdfasdfasdf` FOREIGN KEY (`LOCATION_ID`) REFERENCES `location` (`ID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.flow_camera
CREATE TABLE IF NOT EXISTS `flow_camera` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `SERIAL_NUMBER` varchar(255) DEFAULT NULL,
  `MAC` varchar(255) DEFAULT NULL,
  `IP` varchar(255) NOT NULL DEFAULT '0.0.0.0',
  `X_POS` float NOT NULL DEFAULT -1,
  `Y_POS` float NOT NULL DEFAULT -1,
  `DEVICE_ID` varchar(255) DEFAULT NULL,
  `DEVICE_NAME` varchar(255) DEFAULT NULL,
  `TOTAL_ENTERS` int(16) NOT NULL DEFAULT 0,
  `TOTAL_EXITS` int(16) NOT NULL DEFAULT 0,
  `IS_OFFLINE` bit(1) NOT NULL DEFAULT b'1',
  `TIME` datetime DEFAULT current_timestamp(),
  `ZONE_ID` int(16) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.flow_camera_history
CREATE TABLE IF NOT EXISTS `flow_camera_history` (
  `EVENT_ID` int(11) NOT NULL,
  `CAMERA_ID` int(11) NOT NULL,
  `TIME` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EVENT_ID`,`CAMERA_ID`,`TIME`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.gen_id
CREATE TABLE IF NOT EXISTS `gen_id` (
  `ID` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.history
CREATE TABLE IF NOT EXISTS `history` (
  `ANCHOR_ID` int(11) DEFAULT NULL,
  `EVENT_ID` int(11) NOT NULL,
  `TAG_ID` int(11) NOT NULL,
  `TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `MSEC` smallint(2) NOT NULL,
  `TAG_X_POS` double DEFAULT NULL,
  `TAG_Y_POS` double DEFAULT NULL,
  `PROTOCOL` int(11) NOT NULL DEFAULT 0,
  `MD_TYPE` tinyint(4) NOT NULL DEFAULT 0,
  `PERSON_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`EVENT_ID`,`TAG_ID`,`TIME`,`MSEC`) USING BTREE,
  KEY `TAG_HISTORY` (`TAG_ID`),
  KEY `EVENT_HISTORY` (`EVENT_ID`),
  KEY `FK_PERSON_COVID_ID` (`PERSON_ID`),
  CONSTRAINT `FK_PERSON_COVID_ID` FOREIGN KEY (`PERSON_ID`) REFERENCES `person_x_codid` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.location
CREATE TABLE IF NOT EXISTS `location` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `DESCRIPTION` varchar(1024) DEFAULT NULL,
  `LATITUDE` double DEFAULT NULL,
  `LONGITUDE` double DEFAULT NULL,
  `ICON` varchar(255) DEFAULT NULL,
  `ZOOM` double DEFAULT NULL,
  `RADIUS` double DEFAULT 0,
  `METER_RADIUS` double DEFAULT NULL,
  `IS_INSIDE` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `NAME` (`NAME`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.person_x_codid
CREATE TABLE IF NOT EXISTS `person_x_codid` (
  `ID` int(11) NOT NULL,
  `RAGIONE_SOCIALE` varchar(255) NOT NULL,
  `INIZIO_INFEZIONE` date DEFAULT NULL,
  `ID_TAG` int(11) DEFAULT NULL,
  `IBEACON_MAJOR` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_PERSONS_TAG` (`ID_TAG`),
  CONSTRAINT `FK_PERSONS_TAG` FOREIGN KEY (`ID_TAG`) REFERENCES `tag` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.prohibitions
CREATE TABLE IF NOT EXISTS `prohibitions` (
  `TAG_ID` int(11) NOT NULL,
  `ZONE_ID` int(11) NOT NULL,
  PRIMARY KEY (`TAG_ID`,`ZONE_ID`),
  KEY `zone_tag` (`ZONE_ID`),
  CONSTRAINT `tag_zone` FOREIGN KEY (`TAG_ID`) REFERENCES `tag` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `zone_tag` FOREIGN KEY (`ZONE_ID`) REFERENCES `zone` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.recover_password
CREATE TABLE IF NOT EXISTS `recover_password` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `EMAIL` varchar(255) DEFAULT NULL,
  `CODE` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.rfid_type
CREATE TABLE IF NOT EXISTS `rfid_type` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `TYPE` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.rtls
CREATE TABLE IF NOT EXISTS `rtls` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `PACKETS` int(11) DEFAULT NULL,
  `TIME_LE` datetime DEFAULT NULL,
  `SCANNING_RATE` int(11) DEFAULT NULL,
  `INTERVAL_BEACON_VALID` int(11) DEFAULT NULL,
  `RSSI_THRESHOLD` int(11) DEFAULT NULL,
  `ZOOM_TAG_OUTSIDE_LOCATION` int(11) NOT NULL DEFAULT 0,
  `ZONE_ALPHA` double NOT NULL DEFAULT 0.3,
  `ALERT` bit(1) DEFAULT b'0',
  `SAFE_MON_STATUS` int(11) DEFAULT NULL,
  `TIME_REST` datetime NOT NULL DEFAULT current_timestamp(),
  `IS_ACTIVESAFEMON` bit(1) NOT NULL DEFAULT b'0',
  `IS_ACTIVE_TIME_REST` bit(1) NOT NULL DEFAULT b'0',
  `VERSION` tinytext DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `safeMonKey` (`SAFE_MON_STATUS`),
  CONSTRAINT `safeMonKey` FOREIGN KEY (`SAFE_MON_STATUS`) REFERENCES `safemon` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.safemon
CREATE TABLE IF NOT EXISTS `safemon` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) NOT NULL,
  `COLOR` varchar(255) NOT NULL DEFAULT '#000000',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.safety_box
CREATE TABLE IF NOT EXISTS `safety_box` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `IMEI` varchar(15) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag
CREATE TABLE IF NOT EXISTS `tag` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `TYPE` int(11) NOT NULL DEFAULT 1,
  `X_POS` double NOT NULL DEFAULT 0,
  `Y_POS` double NOT NULL DEFAULT 0,
  `Z_POS` double NOT NULL DEFAULT 0,
  `GPS_NORTH_DEGREE` double NOT NULL DEFAULT 0,
  `GPS_EAST_DEGREE` double NOT NULL DEFAULT 0,
  `TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `GPS_TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `ALARM_TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `BATTERY_STATUS` bit(1) NOT NULL DEFAULT b'0',
  `BATTERY_STATUS_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `MAN_DOWN` bit(1) NOT NULL DEFAULT b'0',
  `MAN_DOWN_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `MAN_DOWN_DISABLED` bit(1) NOT NULL DEFAULT b'0',
  `MAN_DOWN_DISABLED_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `MAN_DOWN_TACITATED` bit(1) NOT NULL DEFAULT b'0',
  `SOS` bit(1) NOT NULL DEFAULT b'0',
  `SOS_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `MAN_IN_QUOTE` bit(1) NOT NULL DEFAULT b'0',
  `MAN_IN_QUOTE_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `CALL_ME_ALARM` bit(1) NOT NULL DEFAULT b'0',
  `CALL_ME_ALARM_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `EVACUATION_ALARM` bit(1) NOT NULL DEFAULT b'0',
  `EVACUATION_ALARM_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `RADIO_SWITCHED_OFF` bit(1) NOT NULL DEFAULT b'0',
  `DIAGNOSTIC_REQUEST` bit(1) NOT NULL DEFAULT b'0',
  `INSIDE_ZONE` bit(1) NOT NULL DEFAULT b'0',
  `INSIDE_ZONE_ALERTED` bit(1) NOT NULL DEFAULT b'0',
  `IS_EXIT` bit(1) NOT NULL DEFAULT b'0',
  `ANCHOR_ID` int(11) DEFAULT NULL,
  `TELEPHONE_NUMBER` varchar(255) DEFAULT NULL,
  `CATEGORY_ID` int(11) DEFAULT NULL,
  `SAFETY_BOX_ID` int(11) DEFAULT NULL,
  `PROTOCOL` int(11) NOT NULL DEFAULT 0,
  `BATTERY_LEVEL` int(11) NOT NULL DEFAULT 100,
  `MD_TYPE` int(11) NOT NULL DEFAULT 0,
  `TEMPERATURE` int(11) NOT NULL DEFAULT 0,
  `ACCESS_CONTROL_ID` int(11) DEFAULT NULL,
  `ACCESS_CONTROL_TIME` datetime NOT NULL DEFAULT current_timestamp(),
  `AZIMUTH` int(11) DEFAULT NULL,
  `RFID_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `ANCHOR_TAG` (`ANCHOR_ID`),
  KEY `fk_tag_category` (`CATEGORY_ID`),
  KEY `fk_tag_safety_box` (`SAFETY_BOX_ID`),
  KEY `FK_ACCESS_CONTROL_ID` (`ACCESS_CONTROL_ID`),
  CONSTRAINT `FK_ACCESS_CONTROL_ID` FOREIGN KEY (`ACCESS_CONTROL_ID`) REFERENCES `access_control` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=306 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag_mac
CREATE TABLE IF NOT EXISTS `tag_mac` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `MAC` varchar(255) DEFAULT NULL,
  `TYPE` int(11) DEFAULT NULL,
  `TAG_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `tag_mac` (`TAG_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag_rangings
CREATE TABLE IF NOT EXISTS `tag_rangings` (
  `TAG_ID` int(11) NOT NULL,
  `RANGINGS` varchar(255) DEFAULT NULL,
  `TIME` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`TAG_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag_rangings2
CREATE TABLE IF NOT EXISTS `tag_rangings2` (
  `TAG_ID` int(11) NOT NULL DEFAULT 0,
  `ANCHOR_ID` int(11) NOT NULL DEFAULT 0,
  `DISTANCE` double NOT NULL DEFAULT 0,
  `TIME` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`TAG_ID`,`ANCHOR_ID`),
  KEY `FK_RANGING_ANCHOR` (`ANCHOR_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag_rfid
CREATE TABLE IF NOT EXISTS `tag_rfid` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NUMBER` varchar(255) CHARACTER SET latin1 NOT NULL,
  `TYPE_ID` int(11) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tag_types
CREATE TABLE IF NOT EXISTS `tag_types` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) DEFAULT NULL,
  `SLEEP_TIME_INDOOR` int(11) DEFAULT NULL,
  `SLEEP_TIME_OUTDOOR` int(11) DEFAULT NULL,
  `ICON_NAME` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.telegram
CREATE TABLE IF NOT EXISTS `telegram` (
  `ID` int(11) NOT NULL,
  `FILE_ID` varchar(255) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.tracking
CREATE TABLE IF NOT EXISTS `tracking` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ANCHOR_ID` int(11) DEFAULT NULL,
  `EVENT_ID` int(11) DEFAULT NULL,
  `TAG_ID` int(11) DEFAULT NULL,
  `TIME` datetime DEFAULT NULL,
  `TAG_X_POS` double NOT NULL DEFAULT -1,
  `TAG_Y_POS` double NOT NULL DEFAULT -1,
  `PROTOCOL` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2529 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.user
CREATE TABLE IF NOT EXISTS `user` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `USERNAME` varchar(255) DEFAULT NULL,
  `PASSWORD` varchar(255) DEFAULT NULL,
  `ONE_LOCATION` bit(1) NOT NULL DEFAULT b'0',
  `EMAIL` varchar(255) DEFAULT NULL,
  `NAME` varchar(255) DEFAULT NULL,
  `ROLE` smallint(1) NOT NULL DEFAULT 0,
  `PASSWORD_CHANGED` bit(1) NOT NULL DEFAULT b'0',
  `USER_SETTINGS` int(11) DEFAULT 1,
  `EMAIL_ALERT` longtext DEFAULT NULL,
  `BOT_URL` varchar(255) DEFAULT NULL,
  `BOT_CHAT_ID` varchar(255) DEFAULT NULL,
  `BOT_ICON_URL` longtext DEFAULT NULL,
  `WEB_SERVICE_URL` varchar(255) DEFAULT NULL,
  `TELEPHONE_NUMBER` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `USER_EMAIL_UINDEX` (`EMAIL`),
  UNIQUE KEY `USER_PASS` (`USERNAME`,`PASSWORD`),
  KEY `USER_SETTINGS` (`USER_SETTINGS`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.user_has_location
CREATE TABLE IF NOT EXISTS `user_has_location` (
  `USER_ID` int(11) NOT NULL,
  `LOCATION_ID` int(11) NOT NULL,
  PRIMARY KEY (`USER_ID`,`LOCATION_ID`),
  KEY `LOCATION_HAS` (`LOCATION_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.user_settings
CREATE TABLE IF NOT EXISTS `user_settings` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `GRID_ON` bit(1) NOT NULL DEFAULT b'1',
  `ANCHORS_ON` bit(1) NOT NULL DEFAULT b'1',
  `CAMERAS_ON` bit(1) NOT NULL DEFAULT b'1',
  `OUTAG_ON` bit(1) NOT NULL DEFAULT b'1',
  `ZONES_ON` bit(1) NOT NULL DEFAULT b'1',
  `SOUND_ON` bit(1) NOT NULL DEFAULT b'1',
  `OUTDOOR_TAG_ON` bit(1) NOT NULL DEFAULT b'1',
  `TABLE_SORTING` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.wetag_settings
CREATE TABLE IF NOT EXISTS `wetag_settings` (
  `TAG_ID` int(11) NOT NULL,
  `ALARM_TIMING` int(11) NOT NULL DEFAULT 10,
  `DISABLE_TIMING` int(11) NOT NULL DEFAULT 1,
  `NO_MOV_TIMING` int(11) NOT NULL DEFAULT 1,
  `ADV_RATE` int(11) NOT NULL DEFAULT 1,
  `SCANNING_RATE` int(11) NOT NULL DEFAULT 1,
  `POWER_LEVEL` int(11) NOT NULL DEFAULT 8,
  `LND_PRT_TIMING` int(11) NOT NULL DEFAULT 1,
  `FREEFALL_THD` int(11) NOT NULL DEFAULT 1,
  `SCANNING_PKT` int(11) NOT NULL DEFAULT 1,
  `TYPE` int(11) NOT NULL DEFAULT 1,
  `KA` int(11) NOT NULL DEFAULT 1,
  `MAC_FILTER` varchar(255) NOT NULL DEFAULT '',
  `ADVERTISE_IS_HERE` int(11) NOT NULL DEFAULT 1,
  `SIM_IS_HERE` int(11) NOT NULL DEFAULT 1,
  `WIFI_IS_HERE` int(11) NOT NULL DEFAULT 1,
  `PERIODIC_SOUND` int(11) NOT NULL DEFAULT 1,
  `MD_MODE` int(11) NOT NULL DEFAULT 1,
  `REST_NAME` varchar(255) NOT NULL DEFAULT '',
  `SERVER_IP` varchar(255) NOT NULL DEFAULT '',
  `SSID_WIFI` varchar(255) NOT NULL DEFAULT '',
  `PWD_WIFI` varchar(255) NOT NULL DEFAULT '',
  `IP_GATEWAY_WIFI` varchar(255) NOT NULL DEFAULT '',
  `IP_WETAG_WIFI` varchar(255) NOT NULL DEFAULT '',
  `APN_NAME` varchar(255) NOT NULL DEFAULT '',
  `APN_CODE` varchar(255) NOT NULL DEFAULT '',
  `MAC_UWB` varchar(255) NOT NULL DEFAULT '',
  `UDP_PORT_UWB` int(11) DEFAULT NULL,
  `GEOFENCE_THD` int(11) NOT NULL DEFAULT 1,
  `TACITATION_MODE` int(11) NOT NULL DEFAULT 0,
  `LND_PRT_ANGLE` int(11) NOT NULL DEFAULT 7,
  `BEACON_TYPE` int(11) NOT NULL DEFAULT 0,
  `CALL_ME_MODE` int(11) NOT NULL DEFAULT 2,
  `STANDBY_MODE` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`TAG_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.wifi
CREATE TABLE IF NOT EXISTS `wifi` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `IP` varchar(255) DEFAULT NULL,
  `MAC_SERVER_RTLS` varchar(255) DEFAULT NULL,
  `UDP_PORT_BLE` int(11) DEFAULT NULL,
  `UDP_PORT_UWB` int(11) DEFAULT NULL,
  `CALL_ALARM_URL` varchar(255) DEFAULT NULL,
  `UDP_PORT_AOA_BLE` int(11) NOT NULL DEFAULT 6000,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.working_process
CREATE TABLE IF NOT EXISTS `working_process` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DESCRIPTION` varchar(255) NOT NULL DEFAULT '',
  `COLOR` varchar(255) NOT NULL DEFAULT '#000000',
  `FONT_COLOR` varchar(255) NOT NULL DEFAULT '#000000',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4;

-- L’esportazione dei dati non era selezionata.

-- Dump della struttura di tabella smarttrack.zone
CREATE TABLE IF NOT EXISTS `zone` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NAME` varchar(255) DEFAULT NULL,
  `X_LEFT` double DEFAULT NULL,
  `X_RIGHT` double DEFAULT NULL,
  `Y_UP` double DEFAULT NULL,
  `Y_DOWN` double DEFAULT NULL,
  `COLOR` varchar(255) NOT NULL DEFAULT '#FF0000',
  `RADIUS` float DEFAULT NULL,
  `GPS_NORTH` double DEFAULT NULL,
  `GPS_EAST` double DEFAULT NULL,
  `FLOOR_ID` int(11) DEFAULT NULL,
  `LOCATION` varchar(255) DEFAULT NULL,
  `ISACTIVE` tinyint(1) NOT NULL DEFAULT 0,
  `EVENT_ID` int(11) NOT NULL DEFAULT 0,
  `WORK_PROCESS_ID` int(11) DEFAULT NULL,
  `PRIORITY` tinyint(4) NOT NULL DEFAULT 0,
  `HEADER_ORDER` tinyint(4) DEFAULT NULL,
  `HEADER_LEFT_SIDE` bit(1) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ZONE_WORKING_PROCESS` (`WORK_PROCESS_ID`),
  CONSTRAINT `FK_ZONE_WORKING_PROCESS` FOREIGN KEY (`WORK_PROCESS_ID`) REFERENCES `working_process` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=latin1;

-- L’esportazione dei dati non era selezionata.

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
