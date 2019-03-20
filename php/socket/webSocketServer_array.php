<?php /** @noinspection PhpUndefinedFieldInspection */

/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 14/01/19
 * Time: 19.58
 */

require_once '../ajax/helper.php';

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
require_once '../database/connection.php';

class webSocketServerArray implements MessageComponentInterface{
    protected $clients = array();
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

        $this->clients[$conn->resourceId] = array('connection' => $conn);
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
        echo "An error has occurred: {$e->getMessage()}\n";

        $conn->close();
    }

    /**
     * Triggered when a client sends data through the socket
     * @param  \Ratchet\ConnectionInterface $from The socket/connection that sent the message to your application
     * @param  string $msg The message received
     * @throws \Exception
     */
    function onMessage(ConnectionInterface $from, $msg){
        // TODO: Implement onMessage() method.
        $current_connection = $this->clients[$from->resourceId]['connection'];

        $result = array();
        echo sprintf('Connection %d has send message: "%s"' . "\n", $from->resourceId, $msg);

        $decoded_message = json_decode($msg, true);

        switch ($decoded_message['action']){
            case 'login':{
                $result['action'] = 'login';
                $query = $this->connection->login($decoded_message['data']['username'], $decoded_message['data']['password']);

                if ($query instanceof db_errors){
                    $result['result'] = $query->getErrorName();
                }else{
                    $result['result'] = $query;

                    $this->clients[$from->resourceId]['user_data'] = array('username' => $decoded_message['data']['username'], 'id' => $result['result']['id'], 'is_admin' => $result['result']['role']);
                }

                $current_connection->send(json_encode($result));
                break;
            }
            case 'logout':{
                $result['action'] = 'logout';

                $this->clients[$from->resourceId]['user_data'] = [];

                if (empty($this->clients[$from->resourceId]['user_data']))
                    $result['result'] = 'logged_out';
                else
                    $result['result'] = 'not_logged_out';

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_user':{
                $result['action'] = 'get_user';
                var_dump($this->clients[$from->resourceId]['user_data']);

                if (!array_key_exists('user_data', $this->clients[$from->resourceId]))
                    $result['result'] = 'no_user';
                else
                    $result['result'] = array('session_name' => $this->clients[$from->resourceId]['user_data']['username'], 'id' => $this->clients[$from->resourceId]['user_data']['id'], 'is_admin' => $this->clients[$from->resourceId]['user_data']['is_admin']);

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_markers':{
                $result['action'] = 'get_markers';
                $query = $this->connection->get_markers($decoded_message['data']['username']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'insert_location':{
                $result['action'] = 'insert_location';
                $query = $this->connection->insert_location($decoded_message['data']['user'], $decoded_message['data']['name'], $decoded_message['data']['description'],
                    $decoded_message['data']['latitude'], $decoded_message['data']['longitude'], $decoded_message['data']['imageName'], $decoded_message['data']['is_indoor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'save_marker_image':{
                $result['action'] = 'save_marker_image';

                $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                $decodedFile = base64_decode($decodedFile[1]);
                $result['result'] = file_put_contents(MARKERS_IMAGES_PATH . $decoded_message['data']['imageName'], $decodedFile);

                $current_connection->send(json_encode($result));
                break;
            }
            case 'save_floor_image':{
                $result['action'] = 'save_floor_image';

                $query = $this->connection->update_floor_image($decoded_message['data']['name'], $decoded_message['data']['id']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                if ($result['result'] === 1) {
                    $decodedFile = explode('data:image/png;base64,', $decoded_message['data']['image']);
                    $decodedFile = base64_decode($decodedFile[1]);
                    $result['result'] = file_put_contents(FLOOR_IMAGES_PATH . $decoded_message['data']['name'], $decodedFile);

                }

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_history':{
                $result['action'] = 'get_history';
                $fromDate = $decoded_message['data']['fromDate'];
                $toDate = $decoded_message['data']['toDate'];
                $tag = $decoded_message['data']['tag'];
                $event = $decoded_message['data']['event'];


                $query = $this->connection->get_history($fromDate, $toDate, $tag, $event);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'change_password':{
                $result['action'] = 'change_password';
                $query = $this->connection->change_password($decoded_message['data']['oldPassword'], $decoded_message['data']['newPassword']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'save_location':{
                $result['action'] = 'save_location';

                array_push($this->clients[$from->resourceId]['location'], $decoded_message['data']['location']);

                $result['result'] = 'location_saved';

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_location_info':{
                $result['action'] = 'get_location_info';

                $result['result'] = $this->clients[$from->resourceId]['location'];

                if ($result['result'] != '') {
                    $query = $this->connection->get_location_info($result['result']);

                    ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;
                }else{
                    $result['result'] = 'location_not_found';
                }
                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_all_locations':{
                $result['action'] = 'get_all_locations';

                $query = $this->connection->get_all_locations();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_floor_info':{
                $result['action'] = 'get_floor_info';
                $query = $this->connection->get_floor_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_tag_floor':{
                $result['action'] = 'get_tag_floor';
                $query = $this->connection->get_tag_floor($decoded_message['data']['tag']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_anchors_by_floor_and_location':{
                $result['action'] = 'get_anchors_by_floor_and_location';
                $query = $this->connection->get_anchors_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_anchors_by_location':{
                $result['action'] = 'get_anchors_by_location';
                $query = $this->connection->get_anchors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_anchors_by_user':{
                $result['action'] = 'get_anchors_by_user';
                $query = $this->connection->get_anchors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_cameras_by_floor_and_location':{
                $result['action'] = 'get_cameras_by_floor_and_location';
                $query = $this->connection->get_cameras_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_all_tags':{
                $result['action'] = 'get_all_tags';
                $query = $this->connection->get_all_tags();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_tags_by_user':{
                $result['action'] = 'get_tags_by_user';
                $query = $this->connection->get_tags_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_tags_by_floor_and_location':{
                $result['action'] = 'get_tags_by_floor_and_location';
                $query = $this->connection->get_tags_by_floor_and_location($decoded_message['data']['floor'], $decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
//            case 'get_tags_by_location':{
//                $result['action'] = 'get_tags_by_location';
//                $query = $this->connection->get_tags_by_location($decoded_message['data']['location']);
//
//                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;
//
//                $current_connection->send(json_encode($result));
//                break;
//            }
            case 'get_events':{
                $result['action'] = 'get_events';
                $query = $this->connection->get_events();

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_floors_by_location':{
                $result['action'] = 'get_floors_by_location';
                $query = $this->connection->get_floors_by_location($decoded_message['data']['location']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_floors_by_user':{
                $result['action'] = 'get_floors_by_user';
                $query = $this->connection->get_floors_by_user($decoded_message['data']['user']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'change_tag_field':{
                $result['action'] = 'change_tag_field';
                $query = $this->connection->change_tag_field($decoded_message['data']['tag_id'], $decoded_message['data']['tag_field'],
                                                            $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'change_anchor_field':{
                $result['action'] = 'change_anchor_field';
                $query = $this->connection->change_anchor_field($decoded_message['data']['anchor_id'], $decoded_message['data']['anchor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'change_floor_field':{
                $result['action'] = 'change_floor_field';
                $query = $this->connection->change_floor_field($decoded_message['data']['floor_id'], $decoded_message['data']['floor_field'], $decoded_message['data']['field_value']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            case 'get_emergency_info':{
                $result['action'] = 'get_emergency_info';
                $query = $this->connection->get_emergency_info($decoded_message['data']['location'], $decoded_message['data']['floor']);

                ($query instanceof db_errors) ? $result['result'] = $query->getErrorName() : $result['result'] = $query;

                $current_connection->send(json_encode($result));
                break;
            }
            default:
                $current_connection->send(json_encode(array('result' => 'no_action')));
        }
    }
}