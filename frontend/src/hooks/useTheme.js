import { useState, useEffect } from "react";

export const useTheme = () => {
  const [temaOscuro, setTemaOscuro] = useState(() => {
    const saved = localStorage.getItem("chatbot_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    if (temaOscuro) {
      document.body.classList.remove("light-mode");
      localStorage.setItem("chatbot_theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      localStorage.setItem("chatbot_theme", "light");
    }
  }, [temaOscuro]);

  return { temaOscuro, setTemaOscuro };
};
