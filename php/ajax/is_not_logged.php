<?php
/**
 * Created by PhpStorm.
 * User: Daniel Surpanu
 * Date: 8/22/2018
 * Time: 11:48 AM
 */
require_once 'communication.php';

abstract class is_not_logged extends communication {

    function __construct(){
        communication::__construct();

        if($this->check_session())
            $this->json_error("L'utente e' gia' logato", 1);
    }

    /**
     * Funzione che controlla se la sessione e' attiva
     * @return bool - true se la sessione e attiva, false altrimenti
     */
    protected function check_session(){
        if(!isset($_SESSION['id'], $_SESSION['secure'], $_SESSION['username']))
            return false;

        return true;
    }
}