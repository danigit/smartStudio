<?php
   error_reporting(E_ALL);
   
  	// Definizione delle risposte al comando login
	  define('OPERATION_OK','0');
	  define('ERROR_SQL','1');
	  define('ERROR_ACCOUNT_UNKNOWN','2');
	  define('ERROR_PASSWORD','3');
	  define('ERROR_NOT_LOGGED','4');
	  define('ERROR_SYSTEM','5');
	
   // Comandi
   define('CMD_LOGIN','LOGIN');
   define('CMD_GET_POINTS','GETPOINTS');
   define('CMD_SET_POINTS','SETPOINTS');
   define('CMD_LOGOUT','LOGOUT');
   define('CMD_CHANGE_PASSWORD','CHGPASSWORD');
   define('CMD_GET_ANCHORS','GETANCHORS');
   define('CMD_SET_ANCHORS','SETANCHORS');
   define('CMD_GET_BEACONS','GETBEACONS');
   define('CMD_SET_BEACONS','SETBEACONS');
   define('CMD_GET_FLOORS','GETFLOORS');   
   define('CMD_GET_ZONES','GETZONES');
   define('CMD_SET_ZONES','SETZONES');
   define('CMD_GET_HISTORY','GETHISTORY');
   define('CMD_GET_EVENT_LIST','GETEVENTLIST');
   define('CMD_ADVICE_TO_TAG','ADVICE_TO_TAG');
   define('CMD_GET_VIDEO','GETVIDEO');
?>