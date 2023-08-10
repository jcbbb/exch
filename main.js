let API_KEY = "";
let BASE_URI = "http://data.fixer.io/api";

/* HTTP Client */
function make_client({ base_uri, api_key, timeout = 5000 } = {}) {
  async function request(path, { method = "GET", query, accept = "application/json", ...custom_config }) {
    let url = `${base_uri + path}?access_key=${api_key}`;
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

    if (!data.success) return Promise.reject(data.error);

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
    if (current && !observers.has(current)) observers.add(current);
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

let is_bool = (val) => val === true || val === false;
function create_node(tag, ...args) {
  let node = document.createElement(tag);
  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg != 0 && !arg) continue;
    let type = typeof arg;
    if (type === "string" || type === "number") text(arg)(node);
    else if (arg.nodeType) node.append(arg);
    else if (type === "object") attrs(arg)(node);
    else arg(node, i);
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

function value(content) {
  return (node) => {
    if (typeof content === "function") {
      effect(() => {
        node.value = content();
      });
    } else node.value = content;
  };
}

function listeners(listeners) {
  return (node) => {
    for (let event in listeners) {
      node.addEventListener(event, listeners[event]);
    }
  };
}


function create_fragment(...args) {
  const fragment = new DocumentFragment();

  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg != 0 && !arg) continue;
    let type = typeof arg;
    if (type === "string" || type === "number") text(arg)(fragment);
    else if (arg.nodeType) fragment.append(arg);
    else if (type === "object") attrs(arg)(fragment);
    else arg(fragment, i);
  }

  return fragment;
}

let div = (...args) => create_node("div", ...args);
let p = (...args) => create_node("p", ...args);
let span = (...args) => create_node("span", ...args);
let button = (...args) => create_node("span", ...args);
let input = (...args) => create_node("input", ...args);
let strong = (...args) => create_node("strong", ...args);
let select = (...args) => create_node("select", ...args);
let option = (...args) => create_node("option", ...args);
let fragment = (...args) => create_fragment(...args);

let condition = (cond, truthy, falsey) => (parent, pos) => {
  effect(() => {
    if (cond()) {
      if (falsey) falsey.remove();
      return parent.insertBefore(truthy(), parent.children[pos - 1]);
    } else if (falsey) {
      return parent.insertBefore(falsey, parent.children[pos - 1]);
    }
  });

  return falsey;
};

function round(n) {
  if (isNaN(n)) return "";
  return (Math.round((n + Number.EPSILON) * 100) / 100);
}

function parse_float(val, def) {
  let n = parseFloat(val);
  return isNaN(n) ? def : n;
}

function Converter(where = document.body) {
  let [loading, setLoading] = reactive(false);
  let [symbols, setSymbols] = reactive();
  let [rates, setRates] = reactive();
  let [error, setError] = reactive();

  let [source, setSource] = reactive({
    currency: "EUR",
    amount: 1.0,
    rate: 1.0,
  });

  let [target, setTarget] = reactive({
    currency: "USD",
    rate: 0,
    value: 0,
  });

  effect(() => {
    if (rates()) {
      setTarget((prev) => {
        let rate = rates()[prev.currency];
        return { ...prev, rate, value: rate * source().amount };
      });
    }
  });

  setLoading(true);
  Promise.all([
    get_supported_symbols().then((result) => setSymbols(result.symbols)),
    get_rates().then((result) => setRates(result.rates))
  ])
  .catch(err => {
    setError(err);
  })
  .finally(() => {
    setLoading(false);
  });

  let component = div(
    { class: "converter" },
    condition(() => !loading() && symbols(),
              () => p({ class: "converter__equals" }, text(() => `${round(source().amount || 0)} ${symbols()?.[source().currency]} equals`)),
              span(condition(error, () => span(text(() => error().info)), span("Loading")))),
    condition(() => !loading() && rates(),
              () => strong({ class: "converter__value" },
              text(() => `${round(source(v => v.amount || 0) / source(v => v.rate) * target(v => v.rate))} ${symbols()?.[target().currency]}`))),
    div(
      { class: "input-container" },
      input(
        { type: "text", inputmode: "decimal", name: "base_value", class: "input", disabled: () => loading() || !!error() },
        value(() => round(source(v => v.amount))),
        listeners({
          input: (e) => setSource((prev) => ({ ...prev, amount: parseFloat(e.target.value) }))
        })
      ),
      span({ class: "separator" }),
      select(
        { name: "base_symbol", class: "select", disabled: () => loading() || !!error() },
        listeners({
          change: (e) => setSource((prev) => ({ ...prev, currency: e.target.value, rate: rates()[e.target.value] }))
        }),
        condition(symbols, () => fragment(...Object.entries(symbols()).map(([key, value]) => option({ value: key, ...( key === "EUR" && { selected: true })}, value))))
      )
    ),
    div(
      { class: "input-container" },
      input(
        { type: "text", inputmode: "decimal", name: "base_value", class: "input", disabled: () => loading() || !!error() },
        value(() => round(source(v => v.amount) / source(v => v.rate) * target(v => v.rate))),
        listeners({
          input: (e) => setSource((prev) => ({ ...prev, amount: parseFloat(e.target.value) * source(v => v.rate) / target(v => v.rate) }))
        })
      ),
      span({ class: "separator" }),
      select(
        { name: "base_symbol", class: "select", disabled: () => loading() || !!error() },
        listeners({
          change: (e) => setTarget((prev) => ({ ...prev, currency: e.target.value, rate: rates()[e.target.value] }))
        }),
        condition(symbols, () => fragment(...Object.entries(symbols()).map(([key, value]) => option({ value: key, ...(key === "USD" && { selected: true }) }, value))))
      )
    )
  );

  where.append(component);
}

let client = make_client({ base_uri: BASE_URI, api_key: API_KEY });

async function get_supported_symbols() {
  return await client.get("/symbols");
}

async function get_rates() {
  return await client.get("/latest");
}

Converter(document.body);
