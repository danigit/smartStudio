<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.33
 */

class db_errors
{
    public static $ERROR_ON_EXECUTE = 0;
    public static $ERROR_ON_TEST = 1;
    public static $ERROR_ON_EMAIL_DUPLICATE_ENTRY = 2;
    public static $ERROR_ON_USERNAME_DUPLICATE_ENTRY = 3;
    public static $ERROR_ON_REGISTER_USER = 4;
    public static $ERROR_ON_LOGIN = 5;
    public static $ERROR_EMAIL_NOT_FOUND = 6;
    public static $ERROR_ON_CHANGING_PASSWORD = 7;
    public static $ERROR_CODE_NOT_FOUND = 8;
    public static $ERROR_USER_NOT_FOUND = 9;
    public static $ERROR_ON_GETTING_MARKERS = 10;
    public static $ERROR_ON_GETTING_FLOOR_IMAGE = 11;
    public static $ERROR_ON_GETTING_TAGS = 12;
    public static $ERROR_ON_UPDATING_TAG = 13;
    public static $ERROR_ON_CHANGING_PASSWORD_WRONG_OLD = 14;
    public static $ERROR_ON_GETTING_LOCATIONS = 15;
    public static $CONNECTION_ERROR = 16;
    public static $ERROR_ON_DELETING_MAC = 17;
    public static $ERROR_ON_DELETING_ANCHOR = 18;
    public static $ERROR_ON_DELETING_FLOOR = 19;
    public static $ERROR_ON_GETTING_MAC_TYPES = 20;
    public static $ERROR_ON_GETTING_TAG_MACS = 21;
    public static $ERROR_ON_INSERTING_MAC = 22;
    public static $ERROR_ON_SAVING_DRAWING = 23;
    public static $ERROR_ON_GETTING_DRAWING = 24;
    public static $ERROR_ON_UPDATING_ANCHOR_POSITION = 25;
    public static $ERROR_ON_INSERTING_FLOOR = 26;
    public static $ERROR_ON_GETTING_LOCATION_INFO = 27;
    public static $ERROR_ON_GETTING_LOCATION_BY_USER = 28;
    public static $ERROR_ON_GETTING_HISTORY = 29;
    public static $ERROR_ON_GETTING_FLOOR_INFO = 30;
    public static $ERROR_ON_GETTING_ANCHORS = 31;
    public static $ERROR_ON_GETTING_CAMERAS = 32;
    public static $ERROR_ON_GETTING_ANCHOR_TYPES = 33;
    public static $ERROR_ON_GETTING_EVENTS = 34;
    public static $ERROR_ON_GETTING_FLOORS = 35;
    public static $ERROR_ON_UPDATING_FLOOR_IMAGE = 36;
    public static $ERROR_ON_CHANGING_FIELD = 37;
    public static $ERROR_ON_GETTING_EMERGENCY = 38;
    public static $ERROR_ON_GETTING_TAG_OUTDOOR_LOCATION_ZOOM = 39;
    public static $ERROR_ON_GETTING_USER_SETTINGS = 40;
    public static $ERROR_ON_INSERTING_USER = 41;

    private $error;

    /**
     * Constructor that asign to the local variable, the value of the constructor parameter
     * @param $error - the error to be handeled
     */
    public function __construct($error)
    {
        $this->error = $error;
    }

    /**
     * Function that returns the error in the local variable
     * @return mixed - the error to be handeled
     */
    public function getError()
    {
        return $this->error;
    }

    /**
     * Function that returns the description of the function
     * @return string - a string that describe the error
     */
    public function getErrorName()
    {
        switch ($this->error) {
            case 0:
                return 'ERROR_ON_EXECUTE';
            case 1:
                return 'ERROR_ON_TEST';
            case 2:
                return 'ERROR_ON_EMAIL_DUPLICATE_ENTRY';
            case 3:
                return 'ERROR_ON_USERNAME_DUPLICATE_ENTRY';
            case 4:
                return 'ERROR_ON_REGISTER_USER';
            case 5:
                return 'ERROR_ON_LOGIN';
            case 6:
                return 'ERROR_EMAIL_NOT_FOUND';
            case 7:
                return 'ERROR_ON_CHANGING_PASSWORD';
            case 8:
                return 'ERROR_CODE_NOT_FOUND';
            case 9:
                return 'ERROR_USER_NOT_FOUND';
            case 10:
                return 'ERROR_ON_GETTING_MARKERS';
            case 11:
                return 'ERROR_ON_GETTING_FLOOR_IMAGE';
            case 12:
                return 'ERROR_ON_GETTING_TAGS';
            case 13:
                return 'ERROR_ON_UPDATING_TAG';
            case 14:
                return 'ERROR_ON_CHANGING_PASSWORD_WRONG_OLD';
            case 15:
                return 'ERROR_ON_GETTING_LOCATIONS';
            case 16:
                return 'CONNECTION_ERROR';
            case 17:
                return 'ERROR_ON_DELETING_MAC';
            case 18:
                return 'ERROR_ON_DELETING_ANCHOR';
            case 19:
                return 'ERROR_ON_DELETING_FLOOR';
            case 20:
                return 'ERROR_ON_GETTING_MAC_TYPES';
            case 21:
                return 'ERROR_ON_GETTING_TAG_MACS';
            case 22:
                return 'ERROR_ON_INSERTING_MAC';
            case 23:
                return 'ERROR_ON_SAVING_DRAWING';
            case 24:
                return 'ERROR_ON_GETTING_DRAWING';
            case 25:
                return 'ERROR_ON_UPDATING_ANCHOR_POSITION';
            case 26:
                return 'ERROR_ON_INSERTING_FLOOR';
            case 27:
                return 'ERROR_ON_GETTING_LOCATION_INFO';
            case 28:
                return 'ERROR_ON_GETTING_LOCATION_BY_USER';
            case 29:
                return 'ERROR_ON_GETTING_HISTORY';
            case 30:
                return 'ERROR_ON_GETTING_FLOOR_INFO';
            case 31:
                return 'ERROR_ON_GETTING_ANCHORS';
            case 32:
                return 'ERROR_ON_GETTING_CAMERAS';
            case 33:
                return 'ERROR_ON_GETTING_ANCHOR_TYPES';
            case 34:
                return 'ERROR_ON_GETTING_EVENTS';
            case 35:
                return 'ERROR_ON_GETTING_FLOORS';
            case 36:
                return 'ERROR_ON_UPDATING_FLOOR_IMAGE';
            case 37:
                return 'ERROR_ON_CHANGING_FIELD';
            case 38:
                return 'ERROR_ON_GETTING_EMERGENCY';
            case 39:
                return '$ERROR_ON_GETTING_TAG_OUTDOOR_LOCATION_ZOOM';
            case 40:
                return '$ERROR_ON_GETTING_USER_SETTINGSM';
            case 41:
                return '$ERROR_ON_INSERTING_USER';
            default:
                return 'UNKNOWN_ERROR';
        }
    }
}
