import './globals.css'
import WindowSlide from '@/components/WindowSlide'

export const metadata = { title: 'Tasks' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WindowSlide />
        {children}
      </body>
    </html>
  )
}
