import { useState } from "react";
import reactLogo from "@/assets/react.svg";
import wxtLogo from "/wxt.svg";

import "./App.css";

function App() {
	const [count, setCount] = useState(0);

	return (
		<main className="">
			<h1>Click to bookmark site.</h1>
			<p>Click the button below to bookmark the current site.</p>
			<button type="button">Bookmark</button>
		</main>
	);
}

export default App;
