import Link from "next/link";
import PersonaLab from "./persona-lab";
import styles from "./persona.module.css";

export default function PersonaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          <span>Q</span>
          <b>quarkspace</b>
        </Link>
        <nav aria-label="站点导航">
          <Link href="/">首页</Link>
          <Link href="/models">模型观测台</Link>
          <span aria-current="page">Persona Lab</span>
        </nav>
      </header>
      <PersonaLab />
    </main>
  );
}
