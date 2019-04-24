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
        error_log('UTENTE ' . $conn->resourceId . ' CONNESSO.');
        error_log('SESSION STATUS: ' . session_status() );
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
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'login';
                $query = $this->connection->login($decoded_message['data']['username'], $decoded_message['data']['password']);

                if ($query instanceof db_errors){
                    $result['result'] = $query->getErrorName();
                }else{
                    $result['result'] = $query;

                    $_SESSION = array();
                    $_SESSION['username'] = $decoded_message['data']['username'];
                    $_SESSION['id'] = $result['result']['id'];
                    $_SESSION['is_admin'] = $result['result']['role'];
                    session_write_close();
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //handeling logout
            case 'logout':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'logout';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username'])) {
                    $_SESSION = array();
                    session_write_close();
                    $result['result'] = 'logged_out';
                } else
                    $result['result'] = 'not_logged_out';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //geting the user
            case 'get_user':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_user';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username']))
                    $result['result'] = array('session_name' => $_SESSION['username'], 'id' => $_SESSION['id'], 'is_admin' => $_SESSION['is_admin']);
                else
                    $result['result'] = 'no_user';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a location
            case 'insert_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'insert_location';
                $query = $this->connection->insert_location($decoded_message['data']['user'], $decoded_message['data']['name'], $decoded_message['data']['description'],
                    $decoded_message['data']['latitude'], $decoded_message['data']['longitude'], $decoded_message['data']['imageName'], $decoded_message['data']['radius'],
                    $decoded_message['data']['is_indoor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a location
            case 'delete_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'delete_location';

                $query = $this->connection->delete_location($decoded_message['data']['location_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving a location
            case 'save_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'save_location';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username'])) {
                    $_SESSION['location'] = $decoded_message['data']['location'];
                    $result['result'] = 'location_saved';
                } else
                    $result['result'] = 'location_not_saved';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the location field
            case 'change_location_field':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_location_field';
                $query = $this->connection->change_location_field($decoded_message['data']['location_id'], $decoded_message['data']['location_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting a location infos
            case 'get_location_info':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_location_info';

                if (isset($_SESSION['id'], $_SESSION['is_admin'], $_SESSION['username'], $_SESSION['location'])) {
                    $result['result'] = $_SESSION['location'];
                    $query = $this->connection->get_location_info($result['result']);

                    ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;
                } else
                    $result['result'] = 'location_not_found';

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting all the locations
            case 'get_all_locations':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_all_locations';

                $query = $this->connection->get_all_locations();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting a location by user
            case 'get_locations_by_user':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_location_by_user';

                $query = $this->connection->get_locations_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving marker image
            case 'save_marker_image':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'save_marker_image';

                if (array_key_exists('image', $decoded_message['data'])) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(MARKERS_IMAGES_PATH . $decoded_message['data']['imageName'], $decodedFile);
                }

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the locations
            case 'get_markers':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_markers';
                $query = $this->connection->get_markers($decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a floor
            case 'insert_floor':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'insert_floor';
                $query = $this->connection->insert_floor($decoded_message['data']['name'], $decoded_message['data']['map_image'], $decoded_message['data']['map_width'],
                $decoded_message['data']['spacing'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a floor
            case 'delete_floor':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'delete_floor';

                $query = $this->connection->delete_floor($decoded_message['data']['floor_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //saving floor image
            case 'save_floor_image':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'save_floor_image';

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
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'save_floor_image';

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
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_floor_info';
                $query = $this->connection->get_floor_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floors by location
            case 'get_floors_by_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_floors_by_location';
                $query = $this->connection->get_floors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floors by user
            case 'get_floors_by_user':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_floors_by_user';
                $query = $this->connection->get_floors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the floor field
            case 'change_floor_field':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_floor_field';
                $query = $this->connection->change_floor_field($decoded_message['data']['floor_id'], $decoded_message['data']['floor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //save the canvas drawing
            case 'save_drawing':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'save_drawing';
                $query = $this->connection->save_drawing($decoded_message['data']['lines'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the saved drawing
            case 'get_drawing':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_drawing';
                $query = $this->connection->get_drawing($decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a tag
            case 'insert_tag':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'insert_tag';

                $query = $this->connection->insert_tag($decoded_message['data']['name'], $decoded_message['data']['type'], $decoded_message['data']['macs']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a tag
            case 'delete_tag':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'delete_tag';

                $query = $this->connection->delete_tag($decoded_message['data']['tag_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changeng the tag field
            case 'change_tag_field':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_tag_field';
                $query = $this->connection->change_tag_field($decoded_message['data']['tag_id'], $decoded_message['data']['tag_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting all the tags
            case 'get_all_tags':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_all_tags';
                $query = $this->connection->get_all_tags();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tags by user
            case 'get_tags_by_user':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_tags_by_user';
                $query = $this->connection->get_tags_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tags by floor and location
            case 'get_tags_by_floor_and_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_tags_by_floor_and_location';
                $query = $this->connection->get_tags_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tag macs
            case 'get_tag_macs':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_tag_macs';

                $query = $this->connection->get_tag_macs($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the tag types
            case 'get_all_types':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_all_types';

                $query = $this->connection->get_all_types();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the floor of a certain tag
            case 'get_tag_floor':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_tag_floor';
                $query = $this->connection->get_tag_floor($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting a mac
            case 'insert_mac':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'insert_mac';

                $query = $this->connection->insert_mac($decoded_message['data']['name'], $decoded_message['data']['type'], $decoded_message['data']['tag_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting a mac
            case 'delete_mac':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'delete_mac';

                $query = $this->connection->delete_mac($decoded_message['data']['mac_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the mac field
            case 'change_mac_field':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_mac_field';
                $query = $this->connection->change_mac_field($decoded_message['data']['mac_id'], $decoded_message['data']['mac_field'],
                    $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //inserting an anchor
            case 'insert_anchor':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'insert_anchor';

                $query = $this->connection->insert_anchor($decoded_message['data']['name'], $decoded_message['data']['mac'], $decoded_message['data']['type'], $decoded_message['data']['ip'],
                    $decoded_message['data']['rssi'], $decoded_message['data']['proximity'], $decoded_message['data']['permitteds'], $decoded_message['data']['neighbors'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //deleting an anchor
            case 'delete_anchor':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'delete_anchor';

                $query = $this->connection->delete_anchor($decoded_message['data']['anchor_id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchor tipes
            case 'get_anchor_types':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_anchor_types';

                $query = $this->connection->get_anchor_types();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the anchor field
            case 'change_anchor_field':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_anchor_field';
                $query = $this->connection->change_anchor_field($decoded_message['data']['anchor_id'], $decoded_message['data']['anchor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //updating the achor pasition
            case 'update_anchor_position':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'update_anchor_position';

                $query = $this->connection->update_anchor_position($decoded_message['data']['x'], $decoded_message['data']['y'], $decoded_message['data']['id'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by floor and location
            case 'get_anchors_by_floor_and_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_anchors_by_floor_and_location';
                $query = $this->connection->get_anchors_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by location
            case 'get_anchors_by_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_anchors_by_location';
                $query = $this->connection->get_anchors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the anchors by user
            case 'get_anchors_by_user':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_anchors_by_user';
                $query = $this->connection->get_anchors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the history
            case 'get_history':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_history';
                $fromDate = $decoded_message['data']['fromDate'];
                $toDate = $decoded_message['data']['toDate'];
                $tag = $decoded_message['data']['tag'];
                $event = $decoded_message['data']['event'];


                $query = $this->connection->get_history($fromDate, $toDate, $tag, $event);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //changing the password
            case 'change_password':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'change_password';
                $query = $this->connection->change_password($decoded_message['data']['oldPassword'], $decoded_message['data']['newPassword']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the cameras by floor and location
            case 'get_cameras_by_floor_and_location':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_cameras_by_floor_and_location';
                $query = $this->connection->get_cameras_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the events
            case 'get_events':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_events';
                $query = $this->connection->get_events();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            //getting the emergency info
            case 'get_emergency_info':{
                $result['id'] = $decoded_message['id'];
                $result['action'] = 'get_emergency_info';
                $query = $this->connection->get_emergency_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $this->clients[$from->resourceId]->send(json_encode($result));
                break;
            }
            default:
                $this->clients[$from->resourceId]->send(json_encode(array('result' => 'no_action')));
        }
    }
}