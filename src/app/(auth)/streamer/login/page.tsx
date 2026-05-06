import { redirect } from 'next/navigation';

export default function StreamerLoginRedirect() {
  redirect('/login');
}
