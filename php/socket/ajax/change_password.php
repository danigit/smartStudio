<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 19.30
 */

require_once 'is_logged.php';
require_once 'helper.php';

class change_password extends is_logged {
    private $oldPassword, $newPassword, $result;

    protected function input_elaboration(){

        $this->oldPassword = $this->validate_string('oldPassword');
        if ($this->oldPassword == false)
            $this->json_error('Nessuna password inserita inserito');

        $this->newPassword = $this->validate_string('newPassword');
        if ($this->newPassword == false)
            $this->json_error('Nessuna password inserita');
    }

    protected function retrieve_data(){
        $connection = $this->get_connection();
        $this->result = $connection->change_password($this->oldPassword, $this->newPassword);

        if (is_error($this->result)) {
            if ($this->result->getErrorName() == 'ERROR_ON_CHANGING_PASSWORD_WRONG_OLD')
                $this->json_error('Password vecchia non valida');

            $this->json_error("C'è stato un errore in fase di cambio password", $this->result->getErrorName());
        }
    }

    protected function return_data(){
        return array('result' => $this->result);
    }
}

$changePassword = new change_password();
$changePassword->execute();