import styles from './ComingSoon.module.css'

export default function ComingSoon({ modulo }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>🚧</span>
      <h2 className={styles.title}>{modulo}</h2>
      <p className={styles.text}>Este módulo está en desarrollo.</p>
    </div>
  )
}
