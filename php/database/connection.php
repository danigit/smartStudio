<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.16
 */

//require_once 'config.php';
require_once 'helper.php';
require_once 'db_errors.php';

class Connection
{

    private $connection, $query, $result;

    /**
     * Constructor that creates a new connection to the database
     */
    public function __construct()
    {
        $this->connection = new mysqli('localhost', "root", "dani", 'smartStudioNew');

        if (!$this->connection)
            echo 'Connessine non riuscita';
    }

    /**
     * Desctructor that close the existing connection to the database
     */
    function __destruct()
    {
        $this->connection->close();
    }

    /**
     * Function that insert a new user in USERS table
     * @param $username - the email of the user
     * @param $password - the password of the user
     * @return db_errors|mixed - the id fo
     */
    function register($username, $password)
    {
        $hash_code = password_hash($password, PASSWORD_BCRYPT);

        $this->query = 'INSERT INTO user (USERNAME, PASSWORD, EMAIL,  NAME, ROLE) VALUES (?, ?, ?, ?, ?)';

        $this->result = $this->execute_inserting($this->query, 'ssssi', $username, $hash_code, 'dani@gmail.com', 'dani', 1);

        if ($this->result instanceof db_errors)
            return $this->result;
        elseif ($this->result == false)
            return new db_errors(db_errors::$ERROR_ON_REGISTER_USER);

        return $this->connection->insert_id;
    }

    /**
     * Function that controls the user email and user password passed as parameter are in database
     * @param $username - user email
     * @param $password - user password
     * @return db_errors|array - the user id on success or an error on fail
     */
    function login($username, $password)
    {
        $this->query = 'SELECT ID, PASSWORD, ROLE FROM user WHERE  USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_LOGIN);

        $statement->bind_result($res_id, $res_pass, $res_role);
        $fetch = $statement->fetch();

        if ($fetch && password_verify($password, $res_pass))
            return array('id' => $res_id, 'role' => $res_role);

        return new db_errors(db_errors::$ERROR_ON_LOGIN);
    }

    /**
     * Function that control if the email passed as parameter exist in user table and insert the email and code in recover_password table
     * @param $email - the email to be controlled
     * @param $code - the code to be inserted
     * @return array|db_errors
     */
    function control_email($email, $code)
    {
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT ID  FROM user WHERE  EMAIL = ?';
        $statement = $this->execute_selecting($this->query, 's', $email);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        $statement->bind_result($res_id);
        $fetch = $statement->fetch();

        if ($fetch)
            $this->result = array('result' => $res_id);

        $statement->close();

        $this->query = 'INSERT INTO recover_password (EMAIL, CODE) VALUES (?, ?)';
        $result = $this->execute_inserting($this->query, 'ss', $email, $code);

        if ($result instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($result == false)
            array_push($errors, 'false');


        if (!empty($errors)) {
            $this->connection->rollback();
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
        }

        $this->connection->commit();

        return $this->result;
    }

    /**
     * Function thar change the password of the user passed as parameter with the password passed as parameter also
     * @param $code - code that verifies the user
     * @param $username - user to be updated
     * @param $password - new password to be setted
     * @return db_errors|int
     */
    function reset_password($code, $username, $password)
    {
        $hash_password = password_hash($password, PASSWORD_BCRYPT);
        $email = '';
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT EMAIL FROM recover_password WHERE  CODE = ?';
        $statement = $this->execute_selecting($this->query, 's', strtoupper($code));

        if ($statement instanceof db_errors)
            $errors['db'] = 'db_error';
        else if ($statement == false)
            $errors['statement'] = 'statement false';

        $statement->bind_result($res_email);
        $fetch = $statement->fetch();

        if ($fetch) {
            $email = $res_email;
        } else {
            $errors['fetch'] = 'wrong_code';
        }

        $statement->close();

        $this->query = "UPDATE user SET PASSWORD = ? WHERE EMAIL = ? AND USERNAME = ?";
        $statement = $this->execute_selecting($this->query, 'sss', $hash_password, $email, $username);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        $this->result = $this->connection->affected_rows;

        if ($this->result == '0') {
            $errors['update'] = 'username';
        }

        if (!empty($errors)) {
            $this->connection->rollback();
            if ($errors['fetch'])
                return new db_errors(db_errors::$ERROR_CODE_NOT_FOUND);
            else if ($errors['update'])
                return new db_errors(db_errors::$ERROR_USER_NOT_FOUND);

            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);
        }

        $this->query = 'TRUNCATE recover_password';
        $this->connection->query($this->query);


        $this->connection->commit();

        return $this->result;
    }

    function change_password($old_password, $new_password)
    {
        if (!isset($_SESSION))
            session_start();

        $username = $_SESSION['username'];

        $this->query = 'SELECT PASSWORD FROM user WHERE USERNAME = ?';
        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);

        $statement->bind_result($res_pass);
        $fetch = $statement->fetch();

        if (!($fetch && password_verify($old_password, $res_pass)))
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD_WRONG_OLD);

        $statement->close();

        $hash_code = password_hash($new_password, PASSWORD_BCRYPT);

        $this->query = "UPDATE user SET PASSWORD = ? WHERE USERNAME = ?";

        $statement = $this->execute_selecting($this->query, 'ss', $hash_code, $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);

        return $this->connection->affected_rows;
    }

    /**
     * Function tha retrieve the markers from the database
     * @param $username
     * @return array|bool|db_errors|mysqli_result
     */
    function get_markers($username)
    {
        $this->query = 'SELECT location.NAME, LATITUDE, LONGITUDE, ICON FROM location 
                  JOIN user_has_location uhl ON location.ID = uhl.LOCATION_ID 
                  JOIN user u on uhl.USER_ID = u.ID WHERE USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $position = array();
            $position[] = $row['LATITUDE'];
            $position[] = $row['LONGITUDE'];

            $result_array[] = array('name' => $row['NAME'], 'position' => $position, "icon" => $row['ICON']);
        }

        return $result_array;
    }

    function insert_location($user, $name, $description, $latitude, $longitude, $image_name)
    {
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = "INSERT INTO location (NAME, DESCRIPTION, LATITUDE, LONGITUDE, ICON) VALUES (?, ?, ?, ?, ?)";
        $statement = $this->execute_inserting($this->query, 'sssss', $name, $description, $latitude, $longitude, $image_name);

        if ($statement instanceof db_errors)
            array_push($errors, 'location_db_error');
        else if ($statement == false)
            array_push($errors, 'location_error');

        $this->result = $this->connection->insert_id;

        $this->query = 'INSERT INTO user_has_location (USER_ID, LOCATION_ID) VALUES (?, ?)';
        $statement = $this->execute_inserting($this->query, 'ii', $user, $this->result);

        if ($statement instanceof db_errors)
            array_push($errors, 'user_location_db_error');
        else if ($statement == false)
            array_push($errors, 'user_location_error');

        $this->connection->commit();

        if (!empty($errors)) {
            $this->connection->rollback();
        }

        return $this->result;
    }

    function get_location_info($location)
    {
        $this->query = 'SELECT location.NAME, DESCRIPTION, LATITUDE, LONGITUDE, ICON, RADIUS, IS_INSIDE FROM location WHERE location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {

            $result_array[] = array('name' => $row['NAME'], 'description' => $row['DESCRIPTION'], 'latitude' => $row['LATITUDE'], 'longitude' => $row['LONGITUDE'],
                "icon" => $row['ICON'], 'radius' => $row['RADIUS'], 'is_inside' => $row['IS_INSIDE']);
        }

        return $result_array;
    }

    function get_history($fromDate, $toDate, $tag, $event){

        $statement = null;

        if (($tag == 'Qualsiasi' && $event == 'Qualsiasi') || ($tag == null && $event == 'Qualsiasi') || ($tag == 'Qualsiasi' && $event == null)) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);
        } else if ($tag != null && $event == 'Qualsiasi') {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE tag.NAME = ? AND history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'sss', $tag, $fromDate, $toDate);
        } else if ($tag == 'Qualsiasi' && $event != null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'sss', $event, $fromDate, $toDate);
        } else if ($event == null && $tag != null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE tag.NAME = ? AND history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'sss', $tag, $fromDate, $toDate);
        } else if ($event != null && $tag == null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'sss', $event, $fromDate, $toDate);
        } else if ($event != null && $tag != null) {
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE event.DESCRIPTION = ? AND tag.NAME = ? AND history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'ssss', $event, $tag, $fromDate, $toDate);
        } else if($tag == null && $event == null){
            $this->query = "SELECT history.TIME, event.DESCRIPTION, anchor.NAME AS ANCHOR_NAME, tag.NAME AS TAG_NAME, l.NAME AS LOCATION_NAME, f.NAME AS FLOOR_NAME, history.TAG_X_POS, history.TAG_Y_POS 
                            FROM history JOIN event ON history.EVENT_ID = event.ID JOIN anchor ON history.ANCHOR_ID = anchor.ID 
                            JOIN tag ON history.TAG_ID = tag.ID JOIN floor f on anchor.FLOOR_ID = f.ID JOIN location l on f.LOCATION_ID = l.ID
                            WHERE history.TIME BETWEEN ? AND ? ORDER BY history.time DESC";
            $statement = $this->execute_selecting($this->query, 'ss', $fromDate, $toDate);
        }

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();

        $array_result = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $array_result[] = array('time' => $row['TIME'], 'event' => $row['DESCRIPTION'], 'anchor' => $row['ANCHOR_NAME'], 'tag' => $row['TAG_NAME'],
                'location' => $row['LOCATION_NAME'], 'floor' => $row['FLOOR_NAME'], 'tag_x_pos' => $row['TAG_X_POS'],
                'tag_y_pos' => $row['TAG_Y_POS']);
        }

        return $array_result;
//        $statement = $this->execute_selecting($this->query, 's', $username);

//        if ($statement instanceof db_errors)
//            return $statement;
//        else if ($statement == false)
//            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);
//
//        $this->result = $statement->get_result();
//        $result_array = array();
//
//        while ($row = mysqli_fetch_assoc($this->result)) {
//            $position = array();
//            $position[] = $row['latitude'];
//            $position[] = $row['longitude'];
//
//            $result_array[] = array('name' => $row['name'], 'position' => $position, "icon" => $row['icon']);
//        }

//        return $result_array;
    }

    /**
     * Function that retrieve the image of the floor passed as the parameter on the location passed as parameter
     * @param $location - the location where the floor is
     * @param $floor - the floor for witch to retrieve the map
     * @return db_errors|array
     */
    function get_floor_info($location, $floor)
    {
        $this->query = 'SELECT floor.ID, floor.NAME, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'width' => $row['MAP_WIDTH'], 'spacing' => $row['MAP_SPACING']);
        }

        return $result_array;
    }

    function get_tag_floor($tag)
    {
        $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, l.NAME AS location_name FROM tag JOIN anchor ON tag.ANCHOR_ID = anchor.ID JOIN floor 
                        ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID WHERE tag.ID = ?';

        $statement = $this->execute_selecting($this->query, 'i', $tag);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'],
                'location_name' => $row['location_name']);
        }

        return $result_array;
    }

    function get_anchors_by_floor_and_location($floor, $location)
    {
        $this->query = 'SELECT anchor.ID, anchor.MAC, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_ONLINE, 
                        EMERGENCY_ZONE, NEIGHBORS, BATTERY_STATUS, FLOOR_ID, l.NAME AS LOCATION_NAME FROM anchor JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l ON floor.LOCATION_ID = l.ID
                        JOIN anchor_types ON anchor.TYPE = anchor_types.ID WHERE floor.NAME = ? AND l.NAME = ?';

        $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'mac' => $row['MAC'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET'], 'is_online' => $row['IS_ONLINE'], 'emergency_zone' => $row['EMERGENCY_ZONE'],
                'neighbors' => $row['NEIGHBORS'], 'battery_status' => $row['BATTERY_STATUS'], 'floor_id' => $row['FLOOR_ID'], 'location_name' => $row['LOCATION_NAME']);
        }

        return $result_array;
    }

    function get_anchors_by_location($location)
    {
        $this->query = 'SELECT anchor.ID, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_ONLINE, floor.NAME AS FLOOR_NAME 
                        FROM anchor JOIN anchor_types ON anchor.TYPE = anchor_types.ID JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID WHERE l.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'], 'is_online' => $row['IS_ONLINE'], 'floor_name' => $row['FLOOR_NAME'],
                'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET']);
        }

        return $result_array;
    }

    function get_anchors_by_user($user)
    {
        $this->query = 'SELECT anchor.ID, anchor.NAME, X_POS, Y_POS, Z_POS, anchor.RADIUS, IP, RSSI_THRESHOLD, PROXIMITY, anchor_types.DESCRIPTION, PERMITTED_ASSET, IS_ONLINE, floor.NAME AS FLOOR_NAME
                        FROM anchor JOIN anchor_types ON anchor.TYPE = anchor_types.ID JOIN floor ON anchor.FLOOR_ID = floor.ID JOIN location l on floor.LOCATION_ID = l.ID 
                        JOIN user_has_location uhl on l.ID = uhl.LOCATION_ID JOIN user ON uhl.USER_ID = user.ID WHERE user.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $user);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'],
                'z_pos' => $row['Z_POS'], 'radius' => $row['RADIUS'], 'ip' => $row['IP'], 'rssi' => $row['RSSI_THRESHOLD'], 'proximity' => $row['PROXIMITY'],
                'type' => $row['DESCRIPTION'], 'permitted_asset' => $row['PERMITTED_ASSET'], 'is_online' => $row['IS_ONLINE'], 'floor_name' => $row['FLOOR_NAME']);
        }

        return $result_array;
    }

    function get_cameras_by_floor_and_location($floor, $location)
    {
        $this->query = 'SELECT camera.ID, camera.DESCRIPTION, USERNAME, PASSWORD, X_POS, Y_POS, camera.RADIUS FROM camera 
                        JOIN floor ON FLOOR_ID = floor.ID JOIN location ON floor.LOCATION_ID = location.ID WHERE floor.NAME = ? AND location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'username' => $row['USERNAME'],
                'password' => $row['PASSWORD'], 'x_pos' => $row['X_POS'], "y_pos" => $row['Y_POS'], 'radius' => $row['RADIUS'], 'is_online' => $row['IS_ONLINE']);
        }

        return $result_array;
    }

//    function get_tags_by_location($location){
//
//        $this->query = 'SELECT tag.id, tag.name FROM tag JOIN anchor ON tag.anchor_id = anchor.id
//                        JOIN floor ON anchor.floor_id = floor.id JOIN location ON floor.location_id = location.id WHERE location.name = ?';
//
//        $statement = $this->execute_selecting($this->query, 's', $location);
//
//        if ($statement instanceof db_errors)
//            return $statement;
//        else if ($statement == false)
//            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);
//
//        $this->result = $statement->get_result();
//        $result_array = array();
//
//        while ($row = mysqli_fetch_assoc($this->result)) {
//            $result_array[] = array('id' => $row['id'], 'name' => $row['name']);
//        }
//
//        return $result_array;
//    }

    function get_tags_by_user($user)
    {

        $this->query = 'SELECT t.ID, t.NAME, tt.DESCRIPTION AS TYPE, t.X_POS, t.Y_POS, t.TIME, t.BATTERY_STATUS, t.GPS_NORTH_DEGREE, t.MAN_DOWN, t.GPS_EAST_DEGREE,
                        t.MAN_DOWN_DISABLED, t.MAN_DOWN_TACITATED, t.SOS, t.MAN_IN_QUOTE, t.CALL_ME_ALARM, t.RADIO_SWITCHED_OFF, t.DIAGNOSTIC_REQUEST, 
                        t.IS_EXIT, floor.NAME AS FLOOR_NAME, floor.IMAGE_MAP, anchor.NAME AS ANCHOR_NAME, tt.ID AS TYPE_ID, tt.SLEEP_TIME_INDOOR, tt.SLEEP_TIME_OUTDOOR, tt.ICON_NAME,
                        dress_alarm.HELMET_DPI, dress_alarm.BELT_DPI, dress_alarm.GLOVE_DPI, dress_alarm.SHOE_DPI, l.NAME AS LOCATION_NAME
                        FROM user JOIN user_has_location uhl ON user.ID = uhl.USER_ID
                        JOIN location l ON uhl.LOCATION_ID = l.ID JOIN floor ON l.ID = floor.LOCATION_ID JOIN anchor ON floor.ID = anchor.FLOOR_ID
                        JOIN tag t ON anchor.ID = t.ANCHOR_ID JOIN tag_types AS tt ON t.TYPE = tt.ID JOIN dress_alarm ON t.ID = dress_alarm.TAG_ID WHERE user.USERNAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $user);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'type_name' => $row['TYPE'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS'],
                'gps_north_degree' => $row['GPS_NORTH_DEGREE'], 'gps_east_degree' => $row['GPS_EAST_DEGREE'], 'radio_switched_off' => $row['RADIO_SWITCHED_OFF'],
                'battery_status' => $row['BATTERY_STATUS'], 'man_down' => $row['MAN_DOWN'],
                'man_down_disabled' => $row['MAN_DOWN_DISABLED'], 'man_down_tacitated' => $row['MAN_DOWN_TACITATED'],
                'sos' => $row['SOS'], 'man_in_quote' => $row['MAN_IN_QUOTE'], 'call_me_alarm' => $row['CALL_ME_ALARM'],
                'diagnostic_request' => $row['DIAGNOSTIC_REQUEST'], 'gps_time' => $row['GPS_TIME'],
                'sleep_time_outdoor' => $row['SLEEP_TIME_OUTDOOR'], 'sleep_time_indoor' => $row['SLEEP_TIME_INDOOR'], 'type_icon' => $row['ICON_NAME'],
                'location_name' => $row['LOCATION_NAME'], 'floor_name' => $row['FLOOR_NAME'], 'floor_image' => $row['IMAGE_MAP'],
                'time' => $row['TIME'], 'is_exit' => $row['IS_EXIT'], 'anchor_name' => $row['ANCHOR_NAME'], 'type_id' => $row['TYPE_ID'],
                'helmet_dpi' => $row['HELMET_DPI'], 'belt_dpi' => $row['BELT_DPI'], 'glove_dpi' => $row['GLOVE_DPI'], 'shoe_dpi' => $row['SHOE_DPI']);
        }

        return $result_array;
    }

    function get_tags_by_floor_and_location($floor, $location)
    {

        $this->query = 'SELECT tag.ID, tag.NAME, tag.X_POS, tag.Y_POS, tag.TIME, tag.BATTERY_STATUS, tag.GPS_NORTH_DEGREE, tag.MAN_DOWN, tag.GPS_EAST_DEGREE,
                        tag.MAN_DOWN_DISABLED, tag.MAN_DOWN_DISABLED_ALERTED, tag.MAN_DOWN_TACITATED, tag.SOS, tag.SOS_ALERTED, tag.MAN_IN_QUOTE, tag.MAN_IN_QUOTE_ALERTED,
                        tag.CALL_ME_ALARM, tag.EVACUATION_ALARM, tag.RADIO_SWITCHED_OFF, tag.DIAGNOSTIC_REQUEST, tag.IS_EXIT, floor.NAME AS FLOOR_NAME, a.NAME AS ANCHOR_NAME, 
                        tag_types.ID AS TYPE_ID, tag_types.DESCRIPTION AS TAG_TYPE_NAME, tag_types.SLEEP_TIME_INDOOR, dress_alarm.HELMET_DPI, dress_alarm.BELT_DPI, dress_alarm.GLOVE_DPI, dress_alarm.SHOE_DPI
                        FROM tag JOIN anchor a ON tag.ANCHOR_ID = a.ID JOIN floor ON a.FLOOR_ID = floor.ID JOIN tag_types ON tag. TYPE = tag_types.ID 
                        JOIN location l ON floor.LOCATION_ID = l.ID JOIN dress_alarm ON tag.ID = dress_alarm.TAG_ID
                        WHERE floor.ID = ? AND l.NAME = ? AND tag.GPS_NORTH_DEGREE = 0 AND tag.GPS_EAST_DEGREE = 0';

        $statement = $this->execute_selecting($this->query, 'ss', $floor, $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS'], 'time' => $row['TIME'], 'battery_status' => $row['BATTERY_STATUS'],
                'gps_north_degree' => $row['GPS_NORTH_DEGREE'], 'man_down' => $row['MAN_DOWN'], 'gps_east_degree' => $row['GPS_EAST_DEGREE'],
                'man_down_disabled' => $row['MAN_DOWN_DISABLED'], 'man_down_disabled_alerted' => $row['MAN_DOWN_DISABLED_ALERTED'], 'man_down_tacitated' => $row['MAN_DOWN_TACITATED'],
                'sos' => $row['SOS'], 'sos_alerted' => $row['SOS_ALERTED'], 'man_in_quote' => $row['MAN_IN_QUOTE'], 'man_in_quote_alerted' => $row['MAN_IN_QUOTE_ALERTED'],
                'call_me_alarm' => $row['CALL_ME_ALARM'], 'evacuation_alarm' => $row['EVACUATION_ALARM'], 'radio_switched_off' => $row['RADIO_SWITCHED_OFF'],
                'diagnostic_request' => $row['DIAGNOSTIC_REQUEST'], 'is_exit' => $row['IS_EXIT'], 'floor_name' => $row['FLOOR_NAME'], 'anchor_name' => $row['ANCHOR_NAME'],
                'tag_type_id' => $row['TYPE_ID'], 'tag_type_name' => $row['TAG_TYPE_NAME'], 'sleep_time_indoor' => $row['SLEEP_TIME_INDOOR'],
                'helmet_dpi' => $row['HELMET_DPI'], 'belt_dpi' => $row['BELT_DPI'], 'glove_dpi' => $row['GLOVE_DPI'], 'shoe_dpi' => $row['SHOE_DPI']);
        }

        return $result_array;
    }

    function get_tags_by_location($location)
    {

        $this->query = 'SELECT t.ID, t.NAME, t.TYPE, t.X_POS, t.Y_POS, t.GPS_NORTH_DEGREE, t.GPS_EAST_DEGREE, t.GPS_TIME, t.BATTERY_STATUS, t.MAN_DOWN,
                        t.MAN_DOWN_DISABLED, t.MAN_DOWN_TACITATED, t.SOS, t.MAN_IN_QUOTE, t.CALL_ME_ALARM, t.RADIO_SWITCHED_OFF, t.DIAGNOSTIC_REQUEST, tt.DESCRIPTION AS type_name, tt.SLEEP_TIME_INDOOR,
                        tt.SLEEP_TIME_OUTDOOR, tt.ICON_NAME FROM tag AS t JOIN tag_types AS tt ON t.TYPE = tt.ID JOIN location l ON t.LOCATION_ID = l.ID 
                        WHERE l.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'type' => $row['TYPE'], 'x_pos' => $row['X_POS'], 'y_pos' => $row['Y_POS'],
                'gps_north_degree' => $row['GPS_NORTH_DEGREE'], 'gps_east_degree' => $row['GPS_EAST_DEGREE'], 'radio_switched_off' => $row['RADIO_SWITCHED_OFF'],
                'battery_status' => $row['BATTERY_STATUS'], 'man_down' => $row['MAN_DOWN'],
                'man_down_disabled' => $row['MAN_DOWN_DISABLED'], 'man_down_tacitated' => $row['MAN_DOWN_TACITATED'],
                'sos' => $row['SOS'], 'man_in_quote' => $row['MAN_IN_QUOTE'], 'call_me_alarm' => $row['CALL_ME_ALARM'],
                'diagnostic_request' => $row['DIAGNOSTIC_REQUEST'], 'gps_time' => $row['GPS_TIME'], 'type_name' => $row['DESCRIPTION'],
                'sleep_time_outdoor' => $row['SLEEP_TIME_OUTDOOR'], 'sleep_time_indoor' => $row['SLEEP_TIME_INDOOR'], 'type_icon' => $row['ICON']);
        }

        return $result_array;
    }

    function get_events()
    {
        $this->query = 'SELECT ID, DESCRIPTION, ICON_NAME FROM event';

        $this->result = $this->connection->query($this->query);

        if ($this->result == false)
            return new db_errors(db_errors::$ERROR_ON_TEST);

        $array_result = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $array_result[] = array('id' => $row['ID'], 'description' => $row['DESCRIPTION'], 'icon_name' => $row['ICON_NAME']);
        }

        return $array_result;
    }

    function get_floors_by_location($location)
    {
        $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor JOIN location ON floor.LOCATION_ID = location.ID WHERE location.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'], 'map_spacing' => $row['MAP_SPACING']);
        }

        return $result_array;
    }

    function get_floors_by_user($user)
    {
        $this->query = 'SELECT floor.ID, floor.NAME, floor.IMAGE_MAP, floor.MAP_WIDTH, floor.MAP_SPACING FROM floor 
                        JOIN location ON floor.LOCATION_ID = location.ID JOIN user_has_location ON location.ID = user_has_location.LOCATION_ID
                        JOIN user ON user_has_location.USER_ID = user.ID WHERE user.NAME = ?';

        $statement = $this->execute_selecting($this->query, 's', $user);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['ID'], 'name' => $row['NAME'], 'image_map' => $row['IMAGE_MAP'], 'width' => $row['MAP_WIDTH'], 'map_spacing' => $row['MAP_SPACING']);
        }

        return $result_array;
    }

    function update_floor_image($name, $id)
    {
        $this->query = "UPDATE floor SET IMAGE_MAP = ? WHERE ID = ?";

        $statement = $this->execute_selecting($this->query, 'ss', $name, $id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_CHANGING_PASSWORD);

        return $this->connection->affected_rows;
    }

    function change_tag_field($tag_id, $tag_field, $field_value)
    {

        $this->query = "UPDATE tag SET " . strtoupper($tag_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'ss', $field_value, $tag_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result = $this->connection->affected_rows;

        return $this->result;
    }

    function change_anchor_field($anchor_id, $anchor_field, $field_value)
    {
        $this->query = "UPDATE anchor SET " . strtoupper($anchor_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $anchor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result = $this->connection->affected_rows;

        return $this->result;
    }

    function change_floor_field($floor_id, $floor_field, $field_value)
    {
        $this->query = "UPDATE floor SET " . strtoupper($floor_field) . " = ? WHERE ID = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $floor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result = $this->connection->affected_rows;

        return $this->result;
    }

    function get_emergency_info($location, $floor)
    {
        $this->query = 'SELECT tag.NAME AS TAG_NAME, a.NAME AS ANCHOR_NAME FROM tag JOIN anchor a ON tag.ANCHOR_ID = a.ID JOIN floor ON a.FLOOR_ID = floor.ID JOIN location l ON floor.LOCATION_ID = l.ID
                        WHERE l.NAME = ? AND floor.NAME = ? AND a.EMERGENCY_ZONE = 1';

        $statement = $this->execute_selecting($this->query, 'ss', $location, $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('tag_name' => $row['TAG_NAME'], 'anchor_name' => $row['ANCHOR_NAME']);
        }

        return $result_array;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return bool|db_errors - the result of the query
     */
    function execute_inserting($query, $bind_string, ...$params)
    {
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++) {
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try {
            $result = $statement->execute();
            if ($result == false)
                return parse_errors($statement->error_list[0]);
        } catch (Exception $e) {
            return new db_errors(db_errors::$ERROR_ON_EXECUTE);
        }

        $statement->close();
        return $result;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return mysqli_stmt|db_errors
     */
    function execute_selecting($query, $bind_string, ...$params)
    {
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++) {
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try {
            $statement->execute();
        } catch (Exception $e) {
            return new db_errors(db_errors::$ERROR_ON_EXECUTE);
        }

        return $statement;
    }
}

//$conn = new Connection();
//$conn->register('dani', 'dani');