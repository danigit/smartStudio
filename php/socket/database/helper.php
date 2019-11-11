<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.52
 */
require_once 'mailer/PHPMailerAutoload.php';

require_once 'db_errors.php';


define('MARKERS_IMAGES_PATH', '../../img/icons/markers/');
define('TAG_CATEGORY_IMAGES_PATH', '../../img/icons/tags/');
define('FLOOR_IMAGES_PATH', '../../img/floors/');

/**
 * Functions that parse an error array and return the appropriate error object
 * @param $errors - the array containing the errors
 * @return db_errors - the parsed error
 */
function parse_errors($errors){
    $errno = $errors['errno'];
    if ($errno === 1062){
        $column = parse_string($errno);
        if ($column === "'email'")
            return new db_errors(db_errors::$ERROR_ON_EMAIL_DUPLICATE_ENTRY);
        if ($column === "'username'")
            return new db_errors(db_errors::$ERROR_ON_USERNAME_DUPLICATE_ENTRY);
    }

    return new db_errors(db_errors::$ERROR_ON_EXECUTE);
}

/**
 * Function that parse a string and returns and returns the error retrieved from the string
 * @param $error_string - the string from witch extract the error
 * @return mixed - the error retrieved from the parsed string
 */
function parse_string($error_string){
    $split_error = explode(' ', $error_string);

    return end($split_error);
}

function sendEmail($email, $code){
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
        $mail->addAddress($email);
        $mail->Subject = "Recupero password";
        $mail->msgHTML("Sei stato contattato da Smart Track per la creazione di un nuovo account riguardante Smart Studio<br><br>
                                  La tua password provisoria e' : <b class='color-ottanio'>" . $code . "</b><br><br>");
        if (!$mail->send()) //telnet smtp.aruba.it 587
            return new db_errors(db_errors::$ERROR_ON_SENDING_EMAIL);
    }catch (Exception $e){
        return new db_errors(db_errors::$ERROR_ON_SENDING_EMAIL);
    }
}

//
///**
// * Function that generates a random code of 6 characters, that has letters an numbers in it
// * @return string - the generated code
// */
//function generateRandomCode() {
//    $chars = "abcdefghijkmnopqrstuvwxyz0123456789";
//    srand((double)microtime()*1000000);
//    $i = 0;
//    $code = '' ;
//
//    while ($i < 6) {
//        $num = rand() % 33;
//        $tmp = substr($chars, $num, 1);
//        $code = $code . $tmp;
//        $i++;
//    }
//
//    return $code;
//
//}