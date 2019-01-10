<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.52
 */

require_once 'db_errors.php';

/**
 * Functions that parse an error array and return the appropriate error object
 * @param $errors - the array containing the errors
 * @return db_errors - the parsed error
 */
function parse_errors($errors){
    $errno = $errors['errno'];
    if ($errno === 1062){
        $column = parse_string($errno);
        if ($column === "'email'")
            return new db_errors(db_errors::$ERROR_ON_EMAIL_DUPLICATE_ENTRY);
    }

    return new db_errors(db_errors::$ERROR_ON_EXECUTE);
}

/**
 * Function that parse a string and returns and returns the error retrieved from the string
 * @param $error_string - the string from witch extract the error
 * @return mixed - the error retrieved from the parsed string
 */
function parse_string($error_string){
    $split_error = explode(' ', $error_string);

    return end($split_error);
}