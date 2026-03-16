import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Cargando datos del embudo…' }: LoadingOverlayProps) {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.spinner} />
      <p className={styles.message}>{message}</p>
    </div>
  );
}
