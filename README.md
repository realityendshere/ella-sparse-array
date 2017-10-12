# Warning: No Longer Actively Developed

Please use [Emberella Sparse](https://github.com/realityendshere/ella-sparse) instead.

# Emberella Sparse Array

Aloha!

Emberella Sparse Array is an Ember CLI addon that provides a sparse array data structure. Its aim is to provide a means for populating an array of data into the client app in "pages" or "chunks" rather than all at once.

For example, imagine you want to show a list with 246,982 records. Well, you could setup routes to paginate the data, showing a few records to the user at a time. Or you could press your luck and try to grab all 246,982 records from your persistence layer at once. Or you could use a sparse array like this one to gradually load only as much data as you need to make the user happy.
