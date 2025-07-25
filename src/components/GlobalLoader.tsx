import React from 'react';

interface GlobalLoaderProps {
  message: string;
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({ message }) => {
  const styles = `
    .globalLoaderContainer {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #f6f6f6 0%, #e8f5f5 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      background-image: url('/assets/loading-animation.svg');
      background-repeat: no-repeat;
      background-position: center;
      background-size: 400px 300px;
    }
    
    .globalLoaderMessage {
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 1.1em;
      color: #009688;
      font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-weight: 500;
      text-align: center;
      opacity: 0.9;
      animation: messageGlow 2s ease-in-out infinite;
    }
    
    @keyframes messageGlow {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    
    @media (max-width: 600px) {
      .globalLoaderContainer {
        background-size: 300px 225px;
      }
      .globalLoaderMessage {
        font-size: 1em;
        bottom: 60px;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      .globalLoaderContainer {
        background: linear-gradient(135deg, #121212 0%, #1e1e1e 100%);
        background-image: url('/assets/loading-animation-dark.svg');
        background-repeat: no-repeat;
        background-position: center;
        background-size: 400px 300px;
      }
      .globalLoaderMessage {
        color: #4db6ac;
      }
    }
    
    @media (max-width: 600px) and (prefers-color-scheme: dark) {
      .globalLoaderContainer {
        background-size: 300px 225px;
      }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="globalLoaderContainer">
        <div className="globalLoaderMessage">{message}</div>
      </div>
    </>
  );
};

export default GlobalLoader;
