import { createStore, combineReducers, applyMiddleware } from "redux";
import { thunk } from "redux-thunk";
import { clientReducer } from "../reducer/client.reducer";

const reducer = combineReducers({
  clientList: clientReducer,
});

const store = createStore(reducer, applyMiddleware(thunk));

export default store;