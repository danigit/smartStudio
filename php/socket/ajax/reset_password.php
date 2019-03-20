<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.30
 */

require_once 'is_not_logged.php';
require_once 'helper.php';

header('Access-Control-Allow-Origin: http://localhost:3000');

class reset_password extends is_not_logged {
    private $code, $username, $password, $re_password, $result;

    protected function input_elaboration(){
        $this->code = $this->validate_string('code');
        if ($this->code == false)
            $this->json_error('Nessuna codice ricevuto');

        $this->username = $this->validate_string('username');
        if ($this->username == false)
            $this->json_error('Nessun username inserito');

        $this->password = $this->validate_string('password');
        if ($this->password == false)
            $this->json_error('Nessuna password inserita');

        $this->re_password = $this->validate_string('repassword');
        if ($this->re_password == false)
            $this->json_error('Nessuna password di conferma inserita');

        if ($this->password !== $this->re_password)
            $this->json_error('Le password non coincidono');
    }

    protected function retrieve_data(){
        $connection = $this->get_connection();
        $this->result = $connection->reset_password($this->code, $this->username, $this->password);

        if (is_error($this->result)) {
            if ($this->result->getErrorName() == 'ERROR_CODE_NOT_FOUND')
                $this->json_error('Codice non valido');
            else if ($this->result->getErrorName() == 'ERROR_USER_NOT_FOUND')
                $this->json_error('Utente non registrato');

            $this->json_error("C'è stato un errore in fase di cambio password", $this->result->getErrorName());
        }
    }

    protected function return_data(){
        return array('result' => $this->result);
    }
}

$resetPassword = new reset_password();
$resetPassword->execute();