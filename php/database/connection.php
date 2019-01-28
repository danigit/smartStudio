<?php
/**
 * Created by IntelliJ IDEA.
 * User: surpa
 * Date: 27/12/18
 * Time: 17.16
 */

require_once 'config.php';
require_once 'db_errors.php';

class Connection{

    private $connection, $query, $result;

    /**
     * Constructor that creates a new connection to the database
     */
    public function __construct(){
        $this->connection = new mysqli(PATH, USERNAME, PASSWORD, DATABASE);

        if (!$this->connection)
            echo 'Connessine non riuscita';
    }

    /**
     * Desctructor that close the existing connection to the database
     */
    function __destruct(){
        $this->connection->close();
    }

    /**
     * Function that insert a new user in USERS table
     * @param $username - the email of the user
     * @param $password - the password of the user
     * @return db_errors|mixed - the id fo
     */
    function register($username, $password){
        $hash_code = password_hash($password, PASSWORD_BCRYPT);

        $this->query = 'INSERT INTO user (username, password, email,  name, role) VALUES (?, ?, ?, ?, ?)';

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
    function login($username, $password){
        $this->query = 'SELECT id, password, role FROM user WHERE  username = ?';

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
    function control_email($email, $code){
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT id  FROM user WHERE  email = ?';
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

        $this->query = 'INSERT INTO recover_password (email, code) VALUES (?, ?)';
        $result = $this->execute_inserting($this->query, 'ss', $email, $code);

        if ($result instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($result == false)
            array_push($errors, 'false');


        if(!empty($errors)){
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
    function reset_password($code, $username, $password){
        $hash_password = password_hash($password, PASSWORD_BCRYPT);
        $email = '';
        $this->connection->autocommit(false);
        $errors = array();

        $this->query = 'SELECT email  FROM recover_password WHERE  code = ?';
        $statement = $this->execute_selecting($this->query, 's', strtoupper($code));

        if ($statement instanceof db_errors)
            $errors['db'] = 'db_error';
        else if ($statement == false)
            $errors['statement'] = 'statement false';

        $statement->bind_result($res_email);
        $fetch = $statement->fetch();

        if ($fetch) {
            $email = $res_email;
        }else{
            $errors['fetch'] = 'wrong_code';
        }

        $statement->close();

        $this->query = "UPDATE user SET password = ? WHERE email = ? AND username = ?";
        $statement = $this->execute_selecting($this->query, 'sss', $hash_password, $email, $username);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        $this->result =  $this->connection->affected_rows;

        if ($this->result == '0'){
            $errors['update'] = 'username';
        }

        if(!empty($errors)){
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

    function change_password($old_password, $new_password){
        if(!isset($_SESSION))
            session_start();

        $username = $_SESSION['username'];

        $this->query = 'SELECT password FROM user WHERE username = ?';
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

        $this->query = "UPDATE user SET password = ? WHERE username = ?";

        $statement = $this->execute_selecting($this->query, 'ss', $hash_code, $username);

        if ($statement instanceof db_errors)
            array_push($errors, 'db_error');
        else if ($statement == false)
            array_push($errors, 'false');

        return $this->connection->affected_rows;
    }
    /**
     * Function tha retrieve the markers from the database
     * @param $username
     * @return array|bool|db_errors|mysqli_result
     */
    function get_markers($username){
        $this->query = 'SELECT location.name as name, latitude, longitude, icon FROM location 
                  JOIN user_has_location uhl ON location.id = uhl.location_id 
                  JOIN user u on uhl.user_id = u.id WHERE username = ?';

        $statement = $this->execute_selecting($this->query, 's', $username);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_MARKERS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $position = array();
            $position[] = $row['latitude'];
            $position[] = $row['longitude'];

            $result_array[] = array('name' => $row['name'], 'position' => $position, "icon" => $row['icon']);
        }

        return $result_array;
    }

    /**
     * Function that retrieve the image of the floor passed as the parameter on the location passed as parameter
     * @param $location - the location where the floor is
     * @param $floor - the floor for witch to retrieve the map
     * @return db_errors|array
     */
    function get_floor_info($location, $floor){
        $this->query = 'SELECT floor.name, image_map, map_width, map_spacing FROM floor 
                        JOIN location ON location_id = location.id WHERE  location.name = ? AND floor.name = ?';

        $statement = $this->execute_selecting($this->query, 'ss', $location, $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('name' => $row['name'], 'image_map' => $row['image_map'], "map_width" => $row['map_width'],
                'map_spacing' => $row['map_spacing']);
        }

        return $result_array;
    }

    function get_anchors($floor){
        $this->query = 'SELECT anchor.id, anchor.name, x_pos, y_pos, z_pos, radius, ip, rssi_threshold, proximity FROM anchor JOIN floor ON anchor.floor_id = floor.id WHERE floor.name = ?';

        $statement = $this->execute_selecting($this->query, 's', $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['id'], 'name' => $row['name'], 'x_pos' => $row['x_pos'], "y_pos" => $row['y_pos'],
                'z_pos' => $row['z_pos'], 'radius' => $row['radius'], 'ip' => $row['ip'], 'rssi' => $row['rssi_threshold'], 'proximity' => $row['proximity']);
        }

        return $result_array;
    }

    function get_cameras($floor){
        $this->query = 'SELECT camera.id, description, username, password, x_pos, y_pos, radius FROM camera 
                        JOIN floor ON floor_id = floor.id WHERE floor.name = ?';

        $statement = $this->execute_selecting($this->query, 's', $floor);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_FLOOR_IMAGE);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['id'], 'description' => $row['description'], 'username' => $row['username'],
                'password' => $row['password'], 'x_pos' => $row['x_pos'], "y_pos" => $row['y_pos'], 'radius' => $row['radius']);
        }

        return $result_array;
    }

    function get_tags($location){

        $this->query = 'SELECT tag.id, tag.name FROM tag JOIN anchor ON tag.anchor_id = anchor.id 
                        JOIN floor ON anchor.floor_id = floor.id JOIN location ON floor.location_id = location.id WHERE location.name = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['id'], 'name' => $row['name']);
        }

        return $result_array;
    }

    function get_floors($location){
        $this->query = 'SELECT floor.id, floor.name, floor.map_width, floor.map_spacing FROM floor JOIN location ON floor.location_id = location.id WHERE location.name = ?';

        $statement = $this->execute_selecting($this->query, 's', $location);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_GETTING_TAGS);

        $this->result = $statement->get_result();
        $result_array = array();

        while ($row = mysqli_fetch_assoc($this->result)) {
            $result_array[] = array('id' => $row['id'], 'name' => $row['name'], 'width' => $row['map_width'], 'spacing' => $row['map_spacing']);
        }

        return $result_array;
    }

    function change_tag_name($tag, $name){

        $this->query = "UPDATE tag SET name = ? WHERE id = ?";
        $statement = $this->execute_selecting($this->query, 'ss', $name, $tag);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    function change_anchor_field($anchor_id, $anchor_field, $field_value){
        $this->query = "UPDATE anchor SET " . $anchor_field . " = ? WHERE id = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $anchor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    function change_floor_field($floor_id, $floor_field, $field_value){
        $this->query = "UPDATE floor SET " . $floor_field . " = ? WHERE id = ?";
        $statement = $this->execute_selecting($this->query, 'si', $field_value, $floor_id);

        if ($statement instanceof db_errors)
            return $statement;
        else if ($statement == false)
            return new db_errors(db_errors::$ERROR_ON_UPDATING_TAG);

        $this->result =  $this->connection->affected_rows;

        return $this->result;
    }

    /**
     * Function that uses the execute statement to execute a query with the prepare statement
     * @param $query - the query to be executed
     * @param $bind_string - the string containing the types of the parameters of the query
     * @param mixed ...$params - the parameters of the query
     * @return bool|db_errors - the result of the query
     */
    function execute_inserting($query, $bind_string, ...$params){
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++){
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try{
            $result = $statement->execute();
            if ($result == false)
                return parse_errors($statement->error_list[0]);
        }catch (Exception $e){
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
    function execute_selecting($query, $bind_string, ...$params){
        $statement = $this->connection->prepare($query);
        $bind_names[] = $bind_string;

        for ($i = 0; $i < count($params); $i++){
            $bind_name = 'bind' . $i;
            $$bind_name = $params[$i];
            $bind_names[] = &$$bind_name;
        }

        call_user_func_array(array($statement, 'bind_param'), $bind_names);

        try{
            $statement->execute();
        }catch (Exception $e){
            return new db_errors(db_errors::$ERROR_ON_EXECUTE);
        }

        return $statement;
    }
}