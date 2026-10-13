export default function ErrorMessage({ error, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <p className="error-box__title">Couldn't load the data</p>
      <p className="muted">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
