import React from 'react';

interface GlobalErrorProps {
  title: string;
  message: string;
}

const GlobalError: React.FC<GlobalErrorProps> = ({ title, message }) => {
  const styles = `
    .errorContainer {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      flex-direction: column;
      background-color: var(--color-background); /* Use CSS variable */
      padding: 20px;
      box-sizing: border-box;
    }
    .errorContent {
      text-align: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: var(--color-surface); /* Use CSS variable */
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .errorTitle {
      font-size: 1.8em;
      color: var(--color-error); /* Use CSS variable */
      margin-bottom: 15px;
    }
    .errorMessage {
      font-size: 1.1em;
      color: var(--color-text-primary); /* Use CSS variable */
      line-height: 1.6;
    }
  `;
  return (
    <>
      <style>{styles}</style>
      <div className="errorContainer">
        <div className="errorContent">
          <h1 className="errorTitle">{title}</h1>
          <p className="errorMessage">{message}</p>
        </div>
      </div>
    </>
  );
};
export default GlobalError;
