import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { ToastContainer, Slide } from "react-toastify";
import axios from "./api/axios.js";
import "react-toastify/dist/ReactToastify.css";
import Login from "./Components/Login";
import Register from "./Components/Register";
import SqlConverter from "./Components/Sqlconverter";

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        transition={Slide}
        progressClassName="custom-progress"
        toastStyle={{
          background: "transparent",
          boxShadow: "none",
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/converter" element={<SqlConverter />} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
