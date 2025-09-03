# 💰 FinanSheet - Personal Finance Tracker

A modern, intuitive personal finance tracker built with React, TypeScript, and Supabase. Track your expenses, manage budgets, and gain insights into your spending habits with a beautiful, responsive interface.

## ✨ Features

- 📊 **Expense Tracking**: Add, edit, and categorize your expenses
- 💳 **Payment Methods**: Track different payment methods (cash, credit cards, etc.)
- 📈 **Visual Analytics**: Charts and graphs to visualize your spending patterns
- 🌍 **Multi-language Support**: Available in multiple languages
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 📤 **Export Functionality**: Export your data to CSV or other formats
- ☁️ **Cloud Sync**: Real-time synchronization with Supabase backend
- 🎨 **Modern UI**: Clean, intuitive interface with smooth animations

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Styling**: CSS Modules, Modern CSS
- **Charts**: Chart.js / Recharts
- **State Management**: React Context API
- **Build Tool**: Vite

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jorge-barrios/FinanSheet.git
   cd FinanSheet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   
   Run the SQL scripts in the `database/` folder in your Supabase SQL editor:
   - `schema.sql` - Creates the necessary tables
   - `functions.sql` - Creates database functions

5. **Start the development server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## 📁 Project Structure

```
FinanSheet/
├── components/          # React components
│   ├── ExpenseForm.tsx
│   ├── ExpenseGrid.tsx
│   ├── Dashboard.tsx
│   └── ...
├── context/            # React context providers
├── hooks/              # Custom React hooks
├── services/           # API services and utilities
├── utils/              # Helper functions
├── locales/            # Internationalization files
├── database/           # Supabase SQL scripts
└── types.ts           # TypeScript type definitions
```

## 🔧 Configuration

### Supabase Setup

1. Create a new project in [Supabase](https://supabase.com)
2. Run the SQL scripts from the `database/` folder
3. Configure Row Level Security (RLS) policies
4. Get your project URL and anon key from the API settings

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key |

## 📊 Database Schema

The application uses the following main tables:

- `expenses` - Stores expense records
- `payment_details` - Stores payment method information
- `categories` - Expense categories
- `users` - User profiles (handled by Supabase Auth)

## 🌐 Internationalization

The app supports multiple languages. Language files are located in the `locales/` directory. To add a new language:

1. Create a new JSON file in `locales/`
2. Add translations for all keys
3. Update the language selector in the app

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Backend powered by [Supabase](https://supabase.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Styled with modern CSS and CSS Modules

## 📞 Support

If you have any questions or need help, please open an issue on GitHub.

---

**Made with ❤️ by Jorge Barrios**
\nDeployment test: 2025-09-03T05:23:05Z
\nRedeploy test: 2025-09-03T05:28:33Z
