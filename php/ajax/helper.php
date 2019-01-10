<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.13
 */

/**
 * Function that apply htmlspecialchar to all the elementas passed as parameter
 * @param $data - the elements on wich apply htmlspecialchar
 * @return array|string - the elements after htmlspecialchar was applied
 */
function escape_array($data){
    if (is_numeric($data) || is_bool($data))
        return $data;
    else if (!is_array($data))
        return htmlspecialchars($data, ENT_QUOTES, 'UTF-8');
    else if (is_array($data)) {
        foreach ($data as $key => $value)
            $data[$key] = escape_array($value);
    }

    return $data;
}

/**
 * Function that controls if the parameter is an object of db_erro class
 * @param $value - the object to be controled
 * @return bool - true if the parameter is an db_error object, false otherwise
 */
function is_error($value){
    return is_a($value, "db_errors");
}

/**
 * Function that set a session for the user passed as parameter
 * @param $id - the id of the user
 * @param $username - the name of the session
 * @param $is_secure
 */
function set_session_variables($id, $username, $is_secure){
    session_start();
    session_regenerate_id();
    $_SESSION = array();
    $_SESSION['username'] = $username;
    $_SESSION['id'] = $id;
    $_SESSION['secure'] = $is_secure;
    session_write_close();
}
