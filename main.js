let api_key = "50353ebb9d28d7d0fc38a31f07066e04";
let base = "http://data.fixer.io/api";

let is_bool = (val) => val === true || val === false;

/* HTTP Client */
function make_client({ base, api_key, timeout = 5000 } = {}) {
  async function request(path, { method = "GET", query, accept = "application/json", ...custom_config }) {
    let url = `${base + path}?access_key=${api_key}`;
    if (query) url += "&" + new URLSearchParams(query);
    let controller = new AbortController();
    let timer_id = setTimeout(controller.abort, timeout);
    let config = {
      signal: controller.signal,
      method,
      ...custom_config,
      headers: {
        Accept: accept,
        ...custom_config.headers
      }
    };

    let response = await fetch(url, config);
    clearTimeout(timer_id);
    let data = response;

    switch (config.headers["Accept"]) {
      case "application/json": {
        data = await response.json();
      } break;
      default:
        break;
    }

    if (!response.ok) {
      return Promise.reject(data);
    }

    return data;
  }

  return {
    get: (path, args) => request(path, { method: "GET", ...args }),
    post: (path, args) => request(path, { method: "POST", ...args })
  };
}

/* State */
let current;
function effect(fn) {
  current = fn;
  fn();
  current = null;
}

function reactive(initial) {
  let val = initial;
  let observers = new Set();

  function getter(modfn = (val) => val) {
    if (current && observers.has(current)) observers.add(current);
    return modfn(val);
  }

  function setter(new_val) {
    if (typeof new_val === "function") val = new_val(val);
    else val = new_val;
    observers.forEach(f => f());
  }

  return [getter, setter];
}

/* DOM */
function create_node(tag, ...args) {
  let node = document.createElement(tag);
  for (let arg of args) {
    if (arg != 0 && !arg) continue;

    let type = typeof arg;
    if (type === "string" || type === "number") text(arg)(node);
    else if (arg.nodeType) node.append(arg);
    else if (type === "object") attrs(arg)(node);
    else arg(node);
  }

  return node;
}

function text(content, modfn) {
  return (node) => {
    if (typeof content === "function") {
      effect(() => {
        node.textContent = content(modfn);
      });
    } else node.textContent = content;

    return node;
  };
}

function attrs(attrs) {
  return (node) => {
    for (let key in attrs) {
      let value = attrs[key];
      if (typeof value === "function") {
        effect(() => {
          let val = value();
          if (is_bool(val)) node.toggleAttribute(key, val, val);
          else node.setAttribute(key, val);
        });
      } else node.setAttribute(key, value);
    }

    return node;
  };
}

let div = (...args) => create_node("div", ...args);
let p = (...args) => create_node("p", ...args);
let span = (...args) => create_node("span", ...args);
let button = (...args) => create_node("span", ...args);
let input = (...args) => create_node("input", ...args);
let strong = (...args) => create_node("strong", ...args);
let select = (...args) => create_node("select", ...args);

function Converter(where = document.body) {
  let [loading, setLoading] = reactive(false);

  let component = div(
    { class: "container" },
    span("1 United states dollar equals"),
    strong("0.90 EURO"),
    div(
      input({ type: "text", name: "base_value" }),
      select({ name: "base_symbol" })
    ),
    div(
      input({ type: "text", name: "base_value" }),
      select({ name: "base_symbol" })
    )
  );

  where.append(component);
}

let client = make_client({ base, api_key });

async function get_supported_symbols() {
  let result = await client.get("/symbols");
  console.log({ result });
}


Converter(document.body);
