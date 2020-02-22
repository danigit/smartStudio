<?php /** @noinspection PhpUndefinedFieldInspection */

/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 14/01/19
 * Time: 19.58
 */

require_once 'ajax/helper.php';
require_once 'database/connection.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class webSocketServer implements MessageComponentInterface{
    protected $clients;
    private $connection;

    public function __construct(){
        $this->clients = [];
        $this->connection = new Connection();
        error_reporting(E_ALL);
        ini_set('display_errors', 0);
        ini_set('log_errors', 1);
        ini_set('error_log', 'SmartStudioErrorLog.txt');
        error_log('SERVER IN ASCOLTO DAL: ' . date("Y-m-d H:i:s"));
    }

    /**
     * When a new connection is opened it will be passed to this method
     * @param  ConnectionInterface $conn The socket/connection that just connected to your application
     * @throws \Exception
     */
    function onOpen(ConnectionInterface $conn){
        error_log('CONNESSIONE SOCKET RISTABILITA DAL CLIENTE ' . $conn->resourceId);
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id();
            error_log('SESSIONE RIGENERATA, ID SESSIONE: ' . session_id());
        }else if (session_status() !== PHP_SESSION_ACTIVE){
            if (session_status() !== PHP_SESSION_NONE) {
                session_start();
                error_log('SESSIONE CON ID ' . session_id() . ' INIZIATA');
            }
        }else{
            error_log('IMPOSSIBILE APRIRE UNA SESSIONE');
        }

        $this->clients[$conn->resourceId] = $conn;
    }

    /**
     * This is called before or after a socket is closed (depends on how it's closed).  SendMessage to $conn will not result in an error if it has already been closed.
     * @param  ConnectionInterface $conn The socket/connection that is closing/closed
     * @throws \Exception
     */
    function onClose(ConnectionInterface $conn){
        unset($this->clients[$conn->resourceId]);
    }

    /**
     * If there is an error with one of the sockets, or somewhere in the application where an Exception is thrown,
     * the Exception is sent back down the stack, handled by the Server and bubbled back up the application through this method
     * @param  ConnectionInterface $conn
     * @param  \Exception $e
     * @throws \Exception
     */
    function onError(ConnectionInterface $conn, \Exception $e){
        // TODO: Implement onError() method.
        $conn->close();
    }

    function isSessionEnded($username){
        $session_ended = isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username_' . $username]);
//        if(!$session_ended)
//            error_log('SESSIONE NON ATTIVE: ' . date("Y-m-d H:i:s"));
        return $session_ended;
    }

    /**
     * Triggered when a client sends data through the socket
     * @param  \Ratchet\ConnectionInterface $from The socket/connection that sent the message to your application
     * @param  string $msg The message received
     * @throws \Exception
     */
    function onMessage(ConnectionInterface $from, $msg){

        $result = array();

        echo sprintf('Connection %d has send message: "%s"' . "\n", $from->resourceId, $msg);

        $decoded_message = json_decode($msg, true);

        switch ($decoded_message['action']){
            //handeling login
            case 'login':{
                $result['action'] = 'login';
                $query = $this->connection->login($decoded_message['data']['username'], $decoded_message['data']['password']);

                if ($query instanceof db_errors){
                    $result['result'] = $query->getErrorName();
                }else{
                    $result['result'] = $query;

                    $_SESSION['username_' . $decoded_message['data']['username']] = $decoded_message['data']['username'];
                    $_SESSION['id'] = $result['result']['id'];
                    $_SESSION['is_admin'] = $result['result']['role'];
                    session_write_close();
                    error_log("UTENTE " . $decoded_message['data']['username'] . ' SI E LOGGATO');
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //handeling logout
            case 'logout':{
                $result['action'] = 'logout';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username_' . $decoded_message['data']['username']])) {
                    error_log('LOGOUT MANUALE DELL\'UTENTE ' . $decoded_message['data']['username']);
                    unset($_SESSION['username_' . $decoded_message['data']['username']]);
                    session_write_close();
                    $result['result'] = 'logged_out';
                } else
                    $result['result'] = 'not_logged_out';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //geting the user
            case 'get_user':{
                $result['action'] = 'get_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username_' . $decoded_message['data']['username']])) {
                    $query = $this->connection->get_user($_SESSION['username_' . $decoded_message['data']['username']]);

                    ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;
                }else {
                    error_log('L\'UTENTE ' . $decoded_message['data']['username'] . ' NON E COLLEGATO');
                    $result['result'] = 'no_user';
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'insert_location':{
                $result['action'] = 'insert_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_location($decoded_message['data']['user'], $decoded_message['data']['name'], $decoded_message['data']['description'],
                    $decoded_message['data']['latitude'], $decoded_message['data']['longitude'], $decoded_message['data']['imageName'], $decoded_message['data']['radius'], $decoded_message['data']['meterRadius'],
                    $decoded_message['data']['is_indoor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a location
            case 'delete_location':{
                $result['action'] = 'delete_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_location($decoded_message['data']['location_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving a location
            case 'save_location':{
                $result['action'] = 'save_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username_' . $decoded_message['data']['username']])) {
                    $_SESSION['location_' . $decoded_message['data']['username']] = $decoded_message['data']['location'];
                    $result['result'] = 'location_saved';
                } else
                    $result['result'] = 'location_not_saved';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'change_location_field':{
                $result['action'] = 'change_location_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_location_field($decoded_message['data']['location_id'], $decoded_message['data']['location_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting a location infos
            case 'get_location_info':{
                $result['action'] = 'get_location_info';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username_' . $decoded_message['data']['username']], $_SESSION['location_' . $decoded_message['data']['username']])) {
                    $result['result'] = $_SESSION['location_' . $decoded_message['data']['username']];
                    $query = $this->connection->get_location_info($result['result']);

                    ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;
                } else
                    $result['result'] = 'location_not_found';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting a location infos
            case 'get_location_tags':{
                $result['action'] = 'get_location_tags';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_location_tags($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting all the locations
            case 'get_all_locations':{
                $result['action'] = 'get_all_locations';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_all_locations();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting a location by user
            case 'get_locations_by_user':{
                $result['action'] = 'get_location_by_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_locations_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving marker image
            case 'save_marker_image':{
                $result['action'] = 'save_marker_image';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (array_key_exists('image', $decoded_message['data'])) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(MARKERS_IMAGES_PATH . $decoded_message['data']['imageName'], $decodedFile);
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving marker image
            case 'save_tag_category_alarm_image':{
                $result['action'] = 'save_tag_category_alarm_image';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (array_key_exists('image', $decoded_message['data'])) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(TAG_CATEGORY_IMAGES_PATH . $decoded_message['data']['imageName'], $decodedFile);
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the locations
            case 'get_markers':{
                $result['action'] = 'get_markers';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_markers($decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a floor
            case 'insert_floor':{
                $result['action'] = 'insert_floor';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_floor($decoded_message['data']['name'], $decoded_message['data']['map_image'], $decoded_message['data']['map_width'],
                $decoded_message['data']['spacing'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a floor
            case 'delete_floor':{
                $result['action'] = 'delete_floor';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_floor($decoded_message['data']['floor_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving floor image
            case 'save_floor_image':{
                $result['action'] = 'save_floor_image';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if (array_key_exists('image', $decoded_message['data'])) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(FLOOR_IMAGES_PATH . $decoded_message['data']['imageName'], $decodedFile);
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //updating floor image
            case 'update_floor_image':{
                $result['action'] = 'save_floor_image';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_floor_image($decoded_message['data']['name'], $decoded_message['data']['id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                if ($result['result'] === 1) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(FLOOR_IMAGES_PATH . $decoded_message['data']['name'], $decodedFile);

                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting floor info
            case 'get_floor_info':{
                $result['action'] = 'get_floor_info';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_floor_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floors by location
            case 'get_floors_by_location':{
                $result['action'] = 'get_floors_by_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_floors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floors by user
            case 'get_floors_by_user':{
                $result['action'] = 'get_floors_by_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_floors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the floor field
            case 'change_floor_field':{
                $result['action'] = 'change_floor_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_floor_field($decoded_message['data']['floor_id'], $decoded_message['data']['floor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //save the canvas drawing
            case 'save_drawing':{
                $result['action'] = 'save_drawing';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->save_drawing($decoded_message['data']['lines'], $decoded_message['data']['floor'], $decoded_message['data']['zones']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the saved drawing
            case 'get_drawing':{
                $result['action'] = 'get_drawing';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_drawing($decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a tag
            case 'insert_tag':{
                $result['action'] = 'insert_tag';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_tag($decoded_message['data']['name'], $decoded_message['data']['type'], $decoded_message['data']['macs']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a tag
            case 'delete_tag':{
                $result['action'] = 'delete_tag';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_tag($decoded_message['data']['tag_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'insert_tag_category':{
                $result['action'] = 'insert_tag_category';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_tag_category($decoded_message['data']['name'], $decoded_message['data']['alarm_name'],
                    $decoded_message['data']['no_alarm_name'], $decoded_message['data']['offline_name']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'insert_safety_box':{
                $result['action'] = 'insert_safety_box';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_safety_box($decoded_message['data']['name'], $decoded_message['data']['imei']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting all the tags
            case 'get_tag_categories':{
                $result['action'] = 'get_tag_categories';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tag_categories();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }

            //getting all the tags
            case 'get_categorie_tags':{
                $result['action'] = 'get_categorie_tags';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_categorie_tags();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_safety_box':{
                $result['action'] = 'get_safety_box';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_safety_box();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changeng the tag field
            case 'change_tag_field':{
                $result['action'] = 'change_tag_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_tag_field($decoded_message['data']['tag_id'], $decoded_message['data']['tag_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'update_tag_type':{
                $result['action'] = 'update_tag_type';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_tag_type($decoded_message['data']['tag'], $decoded_message['data']['type']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting all the tags
            case 'get_all_tags':{
                $result['action'] = 'get_all_tags';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_all_tags();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tags by user
            case 'get_tags_by_user':{
                $result['action'] = 'get_tags_by_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tags_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tags by floor and location
            case 'get_tags_by_floor_and_location':{
                $result['action'] = 'get_tags_by_floor_and_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tags_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tag macs
            case 'get_tag_macs':{
                $result['action'] = 'get_tag_macs';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tag_macs($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_tag_parameters':{
                $result['action'] = 'get_tag_parameterss';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tag_parameters($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_all_tags_macs':{
                $result['action'] = 'get_all_tags_macs';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_all_tags_macs();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'set_call_me':{
                $result['action'] = 'set_call_me';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->set_call_me($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'stop_call_me':{
                $result['action'] = 'stop_call_me';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->stop_call_me($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tag types
            case 'get_all_types':{
                $result['action'] = 'get_all_types';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_all_types();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floor of a certain tag
            case 'get_tag_floor':{
                $result['action'] = 'get_tag_floor';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tag_floor($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a mac
            case 'insert_mac':{
                $result['action'] = 'insert_mac';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_mac($decoded_message['data']['name'], $decoded_message['data']['type'], $decoded_message['data']['tag_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a mac
            case 'delete_mac':{
                $result['action'] = 'delete_mac';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_mac($decoded_message['data']['mac_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'delete_tag_category':{
                $result['action'] = 'delete_tag_category';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_tag_category($decoded_message['data']['category_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'delete_safety_box':{
                $result['action'] = 'delete_safety_box';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_safety_box($decoded_message['data']['safety_box_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'save_category_tags':{
                    $result['action'] = 'save_category_tags';
                    $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                    $query = $this->connection->update_tag_category($decoded_message['data']['data']);

                    ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                    $this->clients[$from->resourceId]->send(json_encode($result));
                    break;
            }
            //changing the mac field
            case 'change_mac_field':{
                $result['action'] = 'change_mac_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_mac_field($decoded_message['data']['mac_id'], $decoded_message['data']['mac_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the mac field
            case 'change_tag_category_field':{
                $result['action'] = 'change_tag_category_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_tag_category_field($decoded_message['data']['category_id'], $decoded_message['data']['category_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the mac field
            case 'change_safety_box_field':{
                $result['action'] = 'change_safety_box_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_safety_box_field($decoded_message['data']['safety_box_id'], $decoded_message['data']['safety_box_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting an anchor
            case 'insert_anchor':{
                $result['action'] = 'insert_anchor';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_anchor($decoded_message['data']['name'], $decoded_message['data']['mac'], $decoded_message['data']['type'], $decoded_message['data']['ip'],
                    $decoded_message['data']['rssi'], $decoded_message['data']['proximity'], $decoded_message['data']['permitteds'], $decoded_message['data']['neighbors'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting an anchor
            case 'delete_anchor':{
                $result['action'] = 'delete_anchor';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_anchor($decoded_message['data']['anchor_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchor tipes
            case 'get_anchor_types':{
                $result['action'] = 'get_anchor_types';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_anchor_types();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the anchor field
            case 'change_anchor_field':{
                $result['action'] = 'change_anchor_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_anchor_field($decoded_message['data']['anchor_id'], $decoded_message['data']['anchor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the anchor field
            case 'update_anchor_permitteds':{
                $result['action'] = 'update_anchor_permitteds';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_anchor_permitteds($decoded_message['data']['anchor_id'], $decoded_message['data']['permitteds']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //updating the achor pasition
            case 'update_anchor_position':{
                $result['action'] = 'update_anchor_position';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_anchor_position($decoded_message['data']['position'], $decoded_message['data']['id'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by floor and location
            case 'get_anchors_by_floor_and_location':{
                $result['action'] = 'get_anchors_by_floor_and_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_anchors_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by location
            case 'get_anchors_by_location':{
                $result['action'] = 'get_anchors_by_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_anchors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by user
            case 'get_anchors_by_user':{
                $result['action'] = 'get_anchors_by_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_anchors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the history
            case 'get_history':{
                $result['action'] = 'get_history';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $fromDate = $decoded_message['data']['fromDate'];
                $toDate = $decoded_message['data']['toDate'];
                $tag = $decoded_message['data']['tag'];
                $event = $decoded_message['data']['event'];


                $query = $this->connection->get_history($fromDate, $toDate, $tag, $event);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_tracking':{
                $result['action'] = 'get_tracking';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $fromDate = $decoded_message['data']['fromDate'];
                $toDate = $decoded_message['data']['toDate'];
                $tag = $decoded_message['data']['tag'];
                $event = $decoded_message['data']['event'];


                $query = $this->connection->get_tracking($fromDate, $toDate, $tag, $event);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }

            case 'delete_history':{
                $result['action'] = 'delete_history';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $fromDate = $decoded_message['data']['fromDate'];
                $toDate = $decoded_message['data']['toDate'];

                $query = $this->connection->delete_history($fromDate, $toDate);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the password
            case 'change_password':{
                $result['action'] = 'change_password';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_password($decoded_message['data']['oldPassword'], $decoded_message['data']['newPassword'], $decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the cameras by floor and location
            case 'get_cameras_by_floor_and_location':{
                $result['action'] = 'get_cameras_by_floor_and_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_cameras_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the events
            case 'get_events':{
                $result['action'] = 'get_events';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_events();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the emergency info
            case 'get_emergency_info':{
                $result['action'] = 'get_emergency_info';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_emergency_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_evacuation':{
                $result['action'] = 'get_evacuation';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_evacuation();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'set_evacuation':{
                $result['action'] = 'set_evacuation';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->set_evacuation();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'stop_evacuation':{
                $result['action'] = 'stop_evacuation';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->stop_evacuation();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the emergency info
            case 'get_tag_outside_location_zoom':{
                $result['action'] = 'get_emergency_info';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_tag_outside_location_zoom();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the user settings
            case 'get_user_settings':{
                $result['action'] = 'get_user_settings';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_user_settings($decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the user settings
            case 'update_user_settings':{
                $result['action'] = 'update_user_settings';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_user_settings($decoded_message['data']['username'], $decoded_message['data']['data']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the user settings
            case 'update_user_role':{
                $result['action'] = 'update_user_role';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_user_role($decoded_message['data']['user'], $decoded_message['data']['role']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'get_floor_zones':{
                $result['action'] = 'get_floor_zones';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_floor_zones($decoded_message['data']['floor'], $decoded_message['data']['location'], $decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'get_outdoor_zones':{
                $result['action'] = 'get_outdoor_zones';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_outdoor_zones($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'insert_floor_zone':{
                $result['action'] = 'insert_floor_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_floor_zone($decoded_message['data']['data']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'insert_outdoor_rect_zone':{
                $result['action'] = 'insert_outdoor_rect_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_outdoor_rect_zone($decoded_message['data']['data']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'insert_outdoor_round_zone':{
                $result['action'] = 'insert_outdoor_round_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_outdoor_round_zone($decoded_message['data']['data']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the zones
            case 'delete_floor_zone':{
                $result['action'] = 'delete_floor_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_floor_zone($decoded_message['data']['zone_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'update_floor_zone':{
                $result['action'] = 'update_floor_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_floor_zone($decoded_message['data']['zone_id'], $decoded_message['data']['x_left'],
                    $decoded_message['data']['x_right'], $decoded_message['data']['y_up'], $decoded_message['data']['y_down']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'change_zone_field':{
                $result['action'] = 'change_zone_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_zone_field($decoded_message['data']['zone_id'], $decoded_message['data']['zone_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'update_zone_color':{
                $result['action'] = 'update_zone_color';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_zone_color($decoded_message['data']['zone_id'], $decoded_message['data']['zone_color']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'delete_floor_zones': {
                $result['action'] = 'delete_floor_zones';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $zones = $decoded_message['data']['zones'];
                $errors = array();

                for ($i = 0; $i < count($zones); $i++){
                    $query = $this->connection->delete_floor_zone($zones[$i]);
                    ($query instanceof db_errors) ? array_push($errors, $query->getErrorName()) : null;
                }

                $result['result'] = $errors;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_forbidden_zones': {
                $result['action'] = 'get_forbidden_zones';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_forbidden_zones($decoded_message['data']['tag_id']);
                ($query instanceof db_errors) ? array_push($errors, $query->getErrorName()) : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'insert_managed_zones': {
                $result['action'] = 'insert_managed_zones';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_managed_zones($decoded_message['data']['tag_id'], $decoded_message['data']['zones']);

                ($query instanceof db_errors) ? array_push($errors, $query->getErrorName()) : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }

            //changing the location field
            case 'delete_managed_zone':{
                $result['action'] = 'delete_managed_zone';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_managed_zone($decoded_message['data']['tag_id'], $decoded_message['data']['zone_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_generic_users':{
                $result['action'] = 'get_generic_users';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_generic_users();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'insert_user':{
                $result['action'] = 'insert_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_user($decoded_message['data']['username'], $decoded_message['data']['name'], $decoded_message['data']['email']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'delete_user':{
                $result['action'] = 'delete_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_user($decoded_message['data']['user_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'change_user_field':{
                $result['action'] = 'change_user_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->change_user_field($decoded_message['data']['user_id'], $decoded_message['data']['user_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_all_users':{
                $result['action'] = 'get_all_users';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_all_users();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'insert_super_user':{
                $result['action'] = 'insert_super_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_super_user($decoded_message['data']['username_reg'], $decoded_message['data']['name'],
                    $decoded_message['data']['email'], $decoded_message['data']['phone'], $decoded_message['data']['emailList'], $decoded_message['data']['botUrl'],
                    $decoded_message['data']['chatId'], $decoded_message['data']['webUrl'], $decoded_message['data']['role']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'delete_super_user':{
                $result['action'] = 'delete_super_user';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_user($decoded_message['data']['user_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'change_super_user_field':{
                $result['action'] = 'change_super_user_field';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                if($decoded_message['data']['field_value'] === '') {
                    $decoded_message['data']['field_value'] = null;
                }

                $query = $this->connection->change_user_field($decoded_message['data']['super_user_id'], $decoded_message['data']['super_user_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_user_locations':{
                $result['action'] = 'get_user_locations';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_user_locations($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'insert_managed_location':{
                $result['action'] = 'insert_managed_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->insert_managed_location($decoded_message['data']['user'], $decoded_message['data']['locations']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'delete_managed_location':{
                $result['action'] = 'delete_managed_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->delete_managed_location($decoded_message['data']['user'], $decoded_message['data']['location_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_indoor_tag_location':{
                $result['action'] = 'get_indoor_tag_location';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_indoor_tag_location($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_alpha':{
                $result['action'] = 'get_alpha';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_alpha();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'get_rtls':{
                $result['action'] = 'get_rtls';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_rtls();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'get_engine_on':{
                $result['action'] = 'get_engine_on';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->get_engine_on();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'update_parameters':{
                $result['action'] = 'update_parameters';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->update_parameters($decoded_message['data']['data']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            case 'set_zoneA_and_zoneB':{
                $result['action'] = 'set_zoneA_and_zoneB';
                $result['session_state'] = $this->isSessionEnded($decoded_message['data']['username']);

                $query = $this->connection->set_zoneA_and_zoneB($decoded_message['data']['work_id'], $decoded_message['data']['zone_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            default:
                $this->clients[$from->resourceId]->send(json_encode(array('result' => 'no_action')));
        }
    }
}