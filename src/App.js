import axios from "axios";
import { useEffect, useState } from "react";

function App() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/users")
      .then(res => setUsers(res.data));
  }, []);

  return (
    <div>
      <h1>Users</h1>
      {users.map(u => (
        <p key={u._id}>{u.name}</p>
      ))}
    </div>
  );
}

export default App;