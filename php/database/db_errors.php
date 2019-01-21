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
    public static $ERROR_ON_UPDATING_TAG = 12;

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
            default:
                return 'UNKNOWN_ERROR';
        }
    }
}
