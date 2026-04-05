import axios from "axios";

// GET CLIENTS
export const fetchClients = () => async (dispatch) => {
  try {
    dispatch({ type: "CLIENT_LIST_REQUEST" });

    const { data } = await axios.get("http://localhost:5000/api/clients");

    dispatch({
      type: "CLIENT_LIST_SUCCESS",
      payload: data,
    });
  } catch (error) {
    dispatch({
      type: "CLIENT_LIST_FAIL",
      payload: error.response?.data?.error || error.message,
    });
  }
};

// ADD CLIENT
export const addClient = (clientData) => async (dispatch) => {
  try {
    dispatch({ type: "CLIENT_CREATE_REQUEST" });

    const { data } = await axios.post(
      "http://localhost:5000/api/clients",
      clientData
    );

    dispatch({
      type: "CLIENT_CREATE_SUCCESS",
      payload: data,
    });
  } catch (error) {
    dispatch({
      type: "CLIENT_CREATE_FAIL",
      payload: error.response?.data?.error || error.message,
    });
  }
};