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
        $zones = array();
        $zones[0] = array('topLeft' => array('x' => 15, 'y' => 15), 'bottomRight' => array('x' => 17, 'y' => 17));
        switch ($function_name) {
            case 'register': var_dump($this->conn->register('dani', 'da'));
                break;
            case 'login': var_dump($this->conn->login('danis', 'dani'));
                break;
            case 'get_floor_image': var_dump($this->conn->get_floor_info('Ospedale Bolzano', 'floor 1'));
                break;
            case 'get_floors': var_dump($this->conn->get_floors('BOLZANO'));
                break;
            case 'get_anchors': var_dump($this->conn->get_anchors_by_floor('floor 1'));
                break;
            case 'change_password': var_dump($this->conn->change_password('da', 'dani'));
                break;
            case 'get_markers': var_dump($this->conn->get_markers('dani'));
                break;
            case 'insert_location': var_dump($this->conn->insert_location('1', 'Universita1', 'Uni1', '414', '110', 'image.png', 1, 1));
                break;
            case 'get_tags_by_user': var_dump($this->conn->get_tags_by_user('dani'));
                break;
            case 'get_tags_by_floor': var_dump($this->conn->get_tags_by_floor(3));
                break;
            case 'change_floor_field': var_dump($this->conn->change_floor_field('3', 'spacing', '100'));
                break;
            case 'update_floor_image': var_dump($this->conn->update_floor_image('new_image.png', '3'));
                break;
            case 'delete_tag': var_dump($this->conn->delete_tag(15));
                break;
            case 'delete_anchor': var_dump($this->conn->delete_anchor(24));
                break;
            case 'insert_tag': var_dump($this->conn->insert_tag('newTag', 'BLUETOOTH_WiFi', ['SRPDNL88B24Z129W']));
                break;
            case 'insert_floor': var_dump($this->conn->insert_floor('newFloor', 'newFloorImage.png', 100, 10, 1));
                break;
            case 'insert_anchor': var_dump($this->conn->insert_anchor('newAnchor', 'DANIELMAC', 'ANCHOR_BLE', 1, 1, 1, [1, 2, 4, 5],"23344,342432,343423",  1));
                break;
            case 'change_anchor_field': var_dump($this->conn->change_anchor_field(1, 'name', 'Anchor100'));
                break;
            case 'update_anchor_position': var_dump($this->conn->update_anchor_position(17.555, 3.222, 13));
                break;
            case 'get_user_settings': var_dump($this->conn->get_user_settings('simone'));
                break;
            case 'save_user_settings': var_dump($this->conn->save_user_settings('simone', array('grid_on' => 1, 'anchors_on' => 1, 'cameras_on' => 1, 'fullscreen_on' => 0)));
                break;
            case 'insert_floor_zone': var_dump($this->conn->insert_floor_zone("{\"name\":\"fdsafdsa\",\"x_left\":1,\"x_right\":1,\"y_up\":1,\"y_down\":1,\"floor\":1}"));
                break;
            case 'insert_user': var_dump($this->conn->insert_user('antani', 'scapelli', 'ds.acconto@gmail.com'));
                break;
            case 'insert_super_user': var_dump($this->conn->insert_super_user('antani', 'scapelli', 0, 0));
                break;
            case 'save_drawing': var_dump($this->conn->save_drawing("", 1, $zones));
                break;
            case 'get_user': var_dump($this->conn->get_user("daniel"));
                break;
            case 'get_engine_on': var_dump($this->conn->get_engine_on());
                break;
            case 'get_history': var_dump($this->conn->get_history("2019-01-15", "2019-06-22", null, null));
                break;
            case 'update_parameters': var_dump($this->conn->update_parameters("{\"adv_rate\":4,\"advertise_is_here\":0,\"alarm_timing\":0,\"apn_code\":\"\",\"apn_name\":\"\",\"disable_timing\":0,\"freefall_thd\":0,\"ip_gateway_wifi\":\"\",\"ip_wetag_wifi\":\"\",\"ka\":0,\"lnd_prt_timing\":0,\"mac_filter\":\"\",\"mac_uwb\":0,\"md_mode\":0,\"no_mov_timing\":0,\"power_level\":0,\"pwd_wifi\":\"\",\"rest_name\":\"\",\"scanning_pkt\":0,\"scanning_rate\":0,\"server_ip\":\"\",\"sim_is_here\":0,\"tag_id\":4,\"udp_port_uwb\":0,\"wifi_is_here\":0}"));
                break;
            case 'update_tag_category': var_dump($this->conn->update_tag_category("[{\"category\": 1, \"tags\": [4, 5]}, {\"category\": 6}]"));
                break;
            default: var_dump('Funzione non esistente');
        }
    }
}

$test = new Test();
$test->test_function('update_tag_category');