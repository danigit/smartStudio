<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.22
 */

require_once '../database/connection.php';
require_once 'helper.php';

abstract class communication{
    private $connection;

    abstract protected function input_elaboration();
    abstract protected function retrieve_data();
    abstract protected function return_data();

    function __construct(){
        if (!isset($_SESSION)) {
            session_start();
        }

        session_write_close();
        ob_start();
    }

    /**
     * Function the intantiate a new connection (if there isn't one) to the database
     * @return Connection - the instantiated connection
     */
    protected function get_connection(){
        if (!isset($this->connection))
            $this->connection = new Connection();

        return $this->connection;
    }

    /**
     * Function that executes all the functions that interact with the database to retrieve data
     */
    function execute(){
        $this->input_elaboration();
        $this->retrieve_data();
        $this->json_success();
    }

    /**
     * Function that takes the result passed as parameter, adds generated errors if any and send it to the client
     * @param $result - the data to be sent to the client
     */
    function json_result($result){
        $res = ob_get_contents();
        ob_end_clean();

        $result['phperrors'] = $res;
        $result = escape_array($result);

        echo json_encode($result);
        die();
    }

    /**
     * Functions that sends data to the client on success
     */
    function json_success(){
        $result = $this->return_data();
        $result['response'] = true;
        $this->json_result($result);
    }

    /**
     * Function that sends data to the client on error
     * @param $message - the message to be sent
     * @param null $db_errors - generated error to be sent if any else sends null
     */
    function json_error($message, $db_errors = null){
        $result = array();
        $result['response'] = false;
        $result['message'] = $message;
        $result['generated_error'] = $db_errors;

        $this->json_result($result);
    }

    /**
     * Function that control if post or get is setted and retrieve the data from them
     * @param $name - the name of the post or get variable
     * @return bool|string - the string sended by the client or false otherwise
     */
    function validate_string($name){
        if (isset($_POST[$name]))
            return trim($_POST[$name]);
        else if (isset($_GET[$name]))
            return trim($_GET[$name]);

        return false;
    }
}