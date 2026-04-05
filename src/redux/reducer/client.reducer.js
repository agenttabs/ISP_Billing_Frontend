const initialState = {
  clients: [],
  loading: false,
  error: null,
};

export const clientReducer = (state = initialState, action) => {
  switch (action.type) {
    case "CLIENT_LIST_REQUEST":
      return { ...state, loading: true };

    case "CLIENT_LIST_SUCCESS":
      return { loading: false, clients: action.payload };

    case "CLIENT_LIST_FAIL":
      return { loading: false, error: action.payload };

    case "CLIENT_CREATE_REQUEST":
      return { ...state, loading: true };

    case "CLIENT_CREATE_SUCCESS":
      return {
        loading: false,
        clients: [...state.clients, action.payload],
      };

    case "CLIENT_CREATE_FAIL":
      return { ...state, loading: false, error: action.payload };

    default:
      return state;
  }
};