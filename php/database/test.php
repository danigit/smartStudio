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
            case 'register': var_dump($this->conn->register('dani', 'da'));
                break;
            case 'login': var_dump($this->conn->login('danis', 'dani'));
                break;
            case 'get_floor_image': var_dump($this->conn->get_floor_info('Ospedale Bolzano', 'floor 1'));
                break;
            case 'get_anchors': var_dump($this->conn->get_anchors('floor 1'));
                break;
            case 'change_password': var_dump($this->conn->change_password('da', 'dani'));
                break;
            case 'get_markers': var_dump($this->conn->get_markers('dani'));
                break;
            case 'insert_location': var_dump($this->conn->insert_location('1', 'Universita1', 'Uni1', '414', '110', 'image.png'));
                break;
            case 'get_tags_by_user': var_dump($this->conn->get_tags_by_user('dani'));
                break;
            default: var_dump('Funzione non esistente');
        }
    }
}

$test = new Test();
$test->test_function('insert_location');