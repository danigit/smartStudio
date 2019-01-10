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
    public static $ERROR_ON_REGISTER_USER = 3;
    public static $ERROR_ON_LOGIN = 4;
    public static $ERROR_ON_INSERTING_PATIENT = 5;
    public static $ERROR_ON_UPDATING_PATIENT = 6;
    public static $ERROR_ON_DELETING_PATIENT = 7;
    public static $ERROR_ON_INSERTING_INVOICE = 8;

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
                return 'ERROR_ON_REGISTER_USER';
            case 4:
                return 'ERROR_ON_LOGIN';
            case 5:
                return 'ERROR_ON_INSERTING_PATIENT';
            case 6:
                return 'ERROR_ON_UPDATING_PATIENT';
            case 7:
                return 'ERROR_ON_DELETING_PATIENT';
            case 8:
                return 'ERROR_ON_INSERTING_INVOICE';
            default:
                return 'UNKNOWN_ERROR';
        }
    }
}
