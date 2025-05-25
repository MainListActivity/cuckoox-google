import React from 'react';

interface GlobalLoaderProps {
  message: string;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ message }) => {
  const styles = `
    .spinnerContainer {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      flex-direction: column;
      background-color: #f0f0f0; /* Optional: a light background */
    }
    .spinner {
      width: 50px; /* Spinner size */
      height: 50px; /* Spinner size */
      border: 6px solid #f3f3f3; /* Light grey circle */
      border-top: 6px solid #3498db; /* Blue arc segment */
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .loadingText {
      margin-top: 25px;
      font-size: 1.25em; /* Slightly larger text */
      color: #333; /* Darker text for better contrast */
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Nicer font */
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="spinnerContainer">
        <div className="spinner"></div>
        <p className="loadingText">{message}</p>
      </div>
    </>
  );
};

export default GlobalLoader;
