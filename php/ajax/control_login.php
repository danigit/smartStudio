<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.30
 */

require_once 'is_logged.php';

header('Access-Control-Allow-Origin: http://localhost:3000');

class control_login extends is_logged {

    protected function input_elaboration(){
    }

    protected function retrieve_data(){
    }

    protected function return_data(){
        $result = array();
        $result['username'] = $_SESSION['username'];
        $result['userid'] = $_SESSION['id'];

        return $result;
    }
}

$control_login = new control_login();
$control_login->execute();