## Currency Converter

### How state management works
I made my own little reactive framework based on [signals](https://solidjs.com/tutorial/introduction_signals) inspired by [Solid.js](https://solidjs.com).
Idea behind state management is simple:
We have `effect` and `reactive` functions

`reactive` works in the following way:

1. First we accept initial value;
2. We create a `Set` to keep track of subscribers (callbacks). These are the functions that will be called whenever value changes;
3. We return `getter` and `setter` methods;

`effect` works in the following way: 

We have a global variable that points to current function of the `effect`. When we call `effect` with a function as an argument, 
we change this global variable to that passed function and call it. When passed function uses `getter` function from the `reactive`,
it automatically gets added to the `Set` in reactive. We use global variable so that we don't have to provide function in `getter`s

### DOM
We have a few DOM helpers functions that leverage `effect`s to create reactive components;

### How to run
1. Get your API key from [Fixer.io](https://fixer.io);
2. Open `main.js` and set `API_KEY` variable to your api key;
3. Just open `index.html` and see if it works;

### Notes
Ideally, you would split `main.js` into several files, but for the purposes of simplicity everything is kept in one file.
