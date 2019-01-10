<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.30
 */

require_once 'is_logged.php';

header('Access-Control-Allow-Origin: http://localhost:3000');

class logout extends is_logged {

    protected function input_elaboration(){
    }

    protected function retrieve_data(){
        session_start();
        $_SESSION = array();
        session_regenerate_id();
        session_write_close();
    }

    protected function return_data(){
        return array();
    }
}

$logout = new logout();
$logout->execute();