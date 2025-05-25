import React from 'react';

interface GlobalLoaderProps {
  message: string;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ message }) => {
  const styles = `
    .pulsingDotsContainer {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      flex-direction: column;
      background-color: #f0f0f0; /* Optional: a light background */
    }
    .dotsWrapper {
      display: flex;
    }
    .dot {
      height: 20px;
      width: 20px;
      margin: 0 5px;
      background-color: #3498db; /* Primary color */
      border-radius: 50%;
      display: inline-block;
      animation: pulse 1.4s infinite ease-in-out both;
    }
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    .loadingText {
      margin-top: 25px;
      font-size: 1.25em; /* Slightly larger text */
      color: #333; /* Darker text for better contrast */
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Nicer font */
    }
    @keyframes pulse {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="pulsingDotsContainer">
        <div className="dotsWrapper">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <p className="loadingText">{message}</p>
      </div>
    </>
  );
};

export default GlobalLoader;
