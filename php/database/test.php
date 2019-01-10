<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.19
 */

require_once 'connection.php';

class Test{
    private $conn;

    /**
     * Constructor that retrieve a new connection to the database
     */
    function __construct(){
        $this->conn = new Connection();
    }

    /**
     * Function that test the connection to the database
     * @param $function_name - the name of the function to be executed
     */
    function test_function($function_name){
        switch ($function_name) {
            case 'register': var_dump($this->conn->register('ds.acconto@gmail.com', 'dani'));
                break;
            case 'login': var_dump($this->conn->login('danis', 'dani'));
                break;
            default: var_dump('Funzione non esistente');
        }
    }
}

$test = new Test();
$test->test_function('login');