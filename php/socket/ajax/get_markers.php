<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.30
 */

require_once 'communication.php';
require_once 'helper.php';

header('Access-Control-Allow-Origin: http://localhost:3000');

class get_markers extends communication {
    private $result;

    protected function input_elaboration(){}

    protected function retrieve_data(){
        $connection = $this->get_connection();
        $this->result = $connection->get_markers();

        if (is_error($this->result)) {
            $this->json_error("C'è stato un errore in fase di recupero markers", $this->result->getErrorName());
        }
    }

    protected function return_data(){
        return array('result' => $this->result);
    }
}

$get_markers = new get_markers();
$get_markers->execute();