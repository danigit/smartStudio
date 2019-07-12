<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 05/11/18
 * Time: 23.47
 */

require_once "../database/mailer/PHPMailerAutoload.php";
require_once 'communication.php';
require_once 'helper.php';

error_reporting(E_ALL);
ini_set('display_errors', 1);

class recover_password extends communication {
    private $email, $result, $code;

    protected function input_elaboration(){
        $this->email = $this->validate_string('email');
        if ($this->email === false)
            $this->json_error("Nessuna email ricevuta");
    }

    protected function retrieve_data(){
        $conn = $this->get_connection();
        $this->code = strtoupper(generateRandomCode());
        $this->result = $conn->control_email($this->email, $this->code);

        if ($this->result == "" || ($this->result instanceof db_errors && $this->result->getErrorName() == 'ERROR_EMAIL_NOT_FOUND')){
            $this->json_error('Email non registrata');
        }else {
            try {
                $mail = new PHPMailer;
                $mail->isSMTP();
                $mail->Host = 'tls://smtp.gmail.com';
                $mail->Port = 587; //587; // 465;
                $mail->SMTPSecure = 'tls';
                $mail->SMTPAuth = true;
                $mail->Username = "";
                $mail->Password = "";
                $mail->setFrom('', 'Smart Studio');
                $mail->addAddress($this->email);
                $mail->Subject = "Recupero password";
                $mail->msgHTML("Sei stato contattato da Smart Track per un cambio password riguardante l'account Smart Studio<br><br>
                                  Il codice per il cambio della email è: <b class='color-ottanio'>" . $this->code . "</b><br><br>");
//                                  Clicca sul seguente link e inserisci il 
//                                  codice presente nella mail: http://danielfotografo.altervista.org/smartStudio/#!/ <br>");
                if (!$mail->send()) //telnet smtp.aruba.it 587
                    $this->json_error("Mail non spedita per motivo sconosciuto" . $mail->ErrorInfo);
            }catch (Exception $e){
                return $e;
            }
        }
    }

    protected function return_data(){
        return array($this->result);
    }
}

$recover_password = new recover_password();
$recover_password->execute();