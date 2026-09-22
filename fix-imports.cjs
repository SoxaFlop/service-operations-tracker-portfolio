const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/Header.tsx',
  'src/components/orders/NewOrderDialog.tsx',
  'src/components/dashboard/DashboardStats.tsx',
  'src/components/views/CompletedOrdersView.tsx',
  'src/components/views/UsersView.tsx',
  'src/components/orders/OrderKanban.tsx',
  'src/components/orders/OrderCard.tsx',
  'src/components/orders/OrderDetailsDialog.tsx',
  'src/components/views/SettingsView.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    if (file === 'src/App.tsx') {
      content = content.replace(/@\/types/g, './types');
      content = content.replace(/@\/firebase/g, './firebase');
    } else {
      content = content.replace(/@\/types/g, '../../types');
      content = content.replace(/@\/firebase/g, '../../firebase');
    }

    fs.writeFileSync(file, content);
  }
});

console.log('Fixed imports');
